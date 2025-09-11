import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  impersonatedUser: User | null;
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
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
  const [originalUser, setOriginalUser] = useState<User | null>(null);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

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
    const redirectUrl = `${window.location.origin}/`;
    
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
      // Fetch the target user's auth data
      const { data: { user: targetUser }, error } = await supabase.auth.admin.getUserById(targetUserId);
      
      if (error || !targetUser) {
        throw new Error("Failed to fetch target user");
      }

      // Store the original user before impersonating
      if (!originalUser) {
        setOriginalUser(user);
      }
      
      // Set the impersonated user
      setImpersonatedUser(targetUser);
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