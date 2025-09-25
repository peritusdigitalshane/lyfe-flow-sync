import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AccountStatusCheckProps {
  children: React.ReactNode;
}

export default function AccountStatusCheck({ children }: AccountStatusCheckProps) {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: rolesLoading } = useRoles();
  const [accountStatus, setAccountStatus] = useState<'loading' | 'pending' | 'active' | 'suspended'>('loading');
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  useEffect(() => {
    if (!user || authLoading) return;

    const checkAccountStatus = async () => {
      try {
        // Check user's profile account status
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('account_status')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching profile:', error);
          setAccountStatus('pending');
          return;
        }

        // If no profile exists, treat as pending
        if (!profile) {
          console.log('No profile found for user, treating as pending');
          setAccountStatus('pending');
          return;
        }

        const status = profile?.account_status as 'pending' | 'active' | 'suspended';
        setAccountStatus(status || 'pending');
      } catch (error) {
        console.error('Error checking account status:', error);
        setAccountStatus('pending');
      }
    };

    checkAccountStatus();
  }, [user, authLoading]);

  const handleCheckPayment = async () => {
    setIsCheckingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        toast.error("Failed to check payment status");
        setIsCheckingPayment(false);
        return;
      }

      if (data.subscribed) {
        toast.success("Payment confirmed! Welcome to LyfeFlow!");
        setAccountStatus('active');
      } else {
        toast.error("Payment not yet confirmed. Please try again in a moment.");
      }
    } catch (error) {
      toast.error("Error checking payment status");
    } finally {
      setIsCheckingPayment(false);
    }
  };

  const handleRetryPayment = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout');
      
      if (error) {
        toast.error("Failed to create payment session");
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      toast.error("Error creating payment session");
    }
  };

  // Show loading while checking auth, roles, or account status
  if (authLoading || rolesLoading || accountStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to auth if not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Super admins bypass payment requirements
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Show payment required screen for pending accounts
  if (accountStatus === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Payment Required</CardTitle>
            <CardDescription>
              Your account is pending payment confirmation. Please complete your subscription to access the dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleCheckPayment} 
              className="w-full" 
              disabled={isCheckingPayment}
            >
              {isCheckingPayment ? "Checking..." : "Check Payment Status"}
            </Button>
            <Button 
              onClick={handleRetryPayment} 
              variant="outline" 
              className="w-full"
            >
              Complete Payment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show suspended account screen
  if (accountStatus === 'suspended') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Account Suspended</CardTitle>
            <CardDescription>
              Your account has been suspended. Please contact support or renew your subscription.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRetryPayment} className="w-full">
              Renew Subscription
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Account is active - show the protected content
  return <>{children}</>;
}