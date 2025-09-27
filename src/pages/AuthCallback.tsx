import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Processing Microsoft OAuth callback...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get("code");
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        if (error) {
          console.error("OAuth error:", error, errorDescription);
          setStatus("error");
          setMessage(`OAuth error: ${errorDescription || error}`);
          toast.error("Authentication failed");
          setTimeout(() => navigate("/dashboard"), 3000);
          return;
        }

        if (!code) {
          setStatus("error");
          setMessage("No authorization code received");
          toast.error("Authentication failed");
          setTimeout(() => navigate("/dashboard"), 3000);
          return;
        }

        setMessage("Checking authentication...");

        // Try to get existing session first
        let currentSession = null;
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (sessionData?.session?.access_token) {
          currentSession = sessionData.session;
          console.log("Found existing session");
        } else {
          console.log("No existing session, trying to refresh...");
          
          // Try to refresh the session
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshData?.session?.access_token) {
            currentSession = refreshData.session;
            console.log("Session refreshed successfully");
          } else {
            console.error("Session refresh failed:", refreshError);
            
            // If no session available, redirect to login but preserve the OAuth state
            const currentUrl = window.location.href;
            localStorage.setItem('oauth_callback_url', currentUrl);
            
            setStatus("error");
            setMessage("Session expired. Please log in and try connecting your mailbox again.");
            toast.error("Session expired - please log in again");
            setTimeout(() => navigate("/auth"), 3000);
            return;
          }
        }

        console.log("Valid session found, proceeding with token exchange");
        setMessage("Exchanging authorization code for tokens...");

        // Check if this is a success callback from the edge function
        const successParam = searchParams.get('success');
        const mailboxId = searchParams.get('mailbox_id');
        
        if (successParam === 'true' && mailboxId) {
          setStatus("success");
          setMessage("Authentication successful! Redirecting...");
          toast.success("Mailbox connected successfully!");
          
          // Check if there's a stored redirect URL (from re-authentication)
          const postAuthRedirect = localStorage.getItem('post_auth_redirect');
          console.log('AuthCallback: Retrieved stored URL:', postAuthRedirect);
          
          if (postAuthRedirect) {
            console.log('AuthCallback: Redirecting to stored URL:', postAuthRedirect);
            localStorage.removeItem('post_auth_redirect');
            
            // Validate the URL before navigating
            if (postAuthRedirect.includes('/undefined')) {
              console.error('AuthCallback: Detected undefined in URL, redirecting to dashboard instead');
              setTimeout(() => navigate("/dashboard"), 2000);
            } else {
              console.log('AuthCallback: Valid URL, navigating to:', postAuthRedirect);
              setTimeout(() => navigate(postAuthRedirect), 2000);
            }
          } else {
            console.log('AuthCallback: No stored URL, redirecting to dashboard');
            setTimeout(() => navigate("/dashboard"), 2000);
          }
          return;
        }

        // Use dynamic redirect URI based on current domain
        const currentOrigin = window.location.origin;
        const redirectUri = `${currentOrigin}/auth/callback`;
        
        console.log('AuthCallback: Using Docker deployment redirect URI:', redirectUri);
        console.log('AuthCallback: Current URL params:', window.location.search);
        console.log('AuthCallback: Code parameter:', code);

        // For Docker deployment, handle OAuth callback directly
        const state = searchParams.get('state');
        console.log('AuthCallback: State parameter:', state);
        
        // No need to fetch OAuth config on client side anymore since 
        // the server-side edge function will handle it

        // Exchange authorization code for access token using server-side edge function
        console.log('AuthCallback: Calling server-side OAuth exchange...');
        
        const { data, error: exchangeError } = await supabase.functions.invoke('mailbox-oauth-callback', {
          body: {
            code: code,
            state: state,
            redirectUri: redirectUri
          }
        });

        console.log('Server-side OAuth exchange response:', { data, error: exchangeError });

        // Check if the response indicates an error
        if (exchangeError || !data?.success) {
          console.error("Token exchange error:", exchangeError || data);
          setStatus("error");
          
          const errorMessage = exchangeError?.message || data?.error || "Failed to exchange authorization code";
          setMessage(errorMessage);
          toast.error("Authentication failed");
          setTimeout(() => navigate("/dashboard"), 5000);
          return;
        }

        setStatus("success");
        setMessage("Authentication successful! Redirecting...");
        toast.success("Mailbox connected successfully!");
        
        // Check if there's a stored redirect URL (from re-authentication)
        const postAuthRedirect = localStorage.getItem('post_auth_redirect');
        console.log('AuthCallback: Retrieved stored URL:', postAuthRedirect);
        console.log('AuthCallback: Current URL:', window.location.href);
        
        if (postAuthRedirect) {
          console.log('AuthCallback: Redirecting to stored URL:', postAuthRedirect);
          localStorage.removeItem('post_auth_redirect');
          
          // Validate the URL before navigating
          if (postAuthRedirect.includes('/undefined')) {
            console.error('AuthCallback: Detected undefined in URL, redirecting to dashboard instead');
            setTimeout(() => navigate("/dashboard"), 2000);
          } else {
            console.log('AuthCallback: Valid URL, navigating to:', postAuthRedirect);
            setTimeout(() => navigate(postAuthRedirect), 2000);
          }
        } else {
          console.log('AuthCallback: No stored URL, redirecting to dashboard');
          setTimeout(() => navigate("/dashboard"), 2000);
        }

      } catch (error) {
        console.error("Callback handling error:", error);
        setStatus("error");
        setMessage("An unexpected error occurred");
        toast.error("Authentication failed");
        setTimeout(() => navigate("/dashboard"), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
      <div className="max-w-md w-full mx-4">
        <div className="bg-background rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            {status === "processing" && (
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
            )}
            {status === "success" && (
              <div className="h-16 w-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {status === "error" && (
              <div className="h-16 w-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>
          
          <h1 className="text-2xl font-bold mb-4">
            {status === "processing" && "Connecting Mailbox"}
            {status === "success" && "Success!"}
            {status === "error" && "Authentication Failed"}
          </h1>
          
          <p className="text-muted-foreground mb-6">{message}</p>
          
          {status === "error" && (
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Return to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}