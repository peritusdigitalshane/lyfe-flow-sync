import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface ImpersonatedUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
  };
  created_at: string;
}

interface AuthContextType {
  user: User | ImpersonatedUser | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  impersonatedUser: ImpersonatedUser | null;
  originalUser: User | null;
  isImpersonating: boolean;
  impersonateUser: (targetUserId: string) => Promise<void>;
  stopImpersonating: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);
  const [originalUser, setOriginalUser] = useState<User | null>(null);

  useEffect(() => {
    console.log('AuthProvider: Initializing auth state...', { 
      hostname: window.location.hostname,
      origin: window.location.origin 
    });
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthProvider: Auth state changed:', { 
          event, 
          hasSession: !!session,
          hostname: window.location.hostname 
        });
        
        // Handle session cleanup for domain switches
        if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
          console.log('AuthProvider: Clearing session state');
          setSession(null);
          setUser(null);
          setImpersonatedUser(null);
          setOriginalUser(null);
        } else if (session) {
          setSession(session);
          setUser(session.user);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session with enhanced error handling
    const initializeSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('AuthProvider: Error getting session:', error);
          // For token errors, attempt to refresh
          if (error.message?.includes('refresh_token_not_found') || error.message?.includes('Invalid Refresh Token')) {
            console.log('AuthProvider: Attempting to clear invalid session');
            await supabase.auth.signOut({ scope: 'local' });
          }
          setSession(null);
          setUser(null);
        } else {
          console.log('AuthProvider: Initial session check:', { 
            hasSession: !!session,
            hostname: window.location.hostname 
          });
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error('AuthProvider: Failed to get session:', error);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeSession();

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    // Use current domain for redirect URL to support Docker deployments
    const redirectUrl = `${window.location.origin}/auth/callback`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setImpersonatedUser(null);
    setOriginalUser(null);
  };

  const impersonateUser = async (targetUserId: string) => {
    try {
      // Call the edge function to impersonate the user
      const { data, error } = await supabase.functions.invoke('impersonate-user', {
        body: { targetUserId }
      });
      
      if (error) {
        throw new Error(error.message || "Failed to impersonate user");
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to impersonate user");
      }

      // Store the original user before impersonating
      if (!originalUser && user && 'aud' in user) {
        setOriginalUser(user as User);
      }
      
      // Create an impersonated user object from the profile data
      const impersonatedUserData: ImpersonatedUser = {
        id: data.targetUser.id,
        email: data.targetUser.email,
        user_metadata: {
          full_name: data.targetUser.full_name
        },
        created_at: data.targetUser.created_at
      };
      
      // Set the impersonated user
      setImpersonatedUser(impersonatedUserData);
    } catch (error) {
      console.error("Error impersonating user:", error);
      throw error;
    }
  };

  const stopImpersonating = () => {
    setImpersonatedUser(null);
    setOriginalUser(null);
  };

  const isImpersonating = impersonatedUser !== null;
  const currentUser = impersonatedUser || user;

  const value = {
    user: currentUser,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    impersonatedUser,
    originalUser,
    isImpersonating,
    impersonateUser,
    stopImpersonating,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}