import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database['public']['Enums']['app_role'];

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
  requireSuperAdmin?: boolean;
  requireAdmin?: boolean;
  requireModerator?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requiredRole,
  requireSuperAdmin = false,
  requireAdmin = false,
  requireModerator = false
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasRole, isSuperAdmin, isAdmin, isModerator, loading: rolesLoading } = useRoles();

  // Show loading while checking auth and roles
  if (authLoading || rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check role-based permissions
  let hasPermission = true;

  if (requireSuperAdmin && !isSuperAdmin) {
    hasPermission = false;
  } else if (requireAdmin && !isAdmin) {
    hasPermission = false;
  } else if (requireModerator && !isModerator) {
    hasPermission = false;
  } else if (requiredRole && !hasRole(requiredRole)) {
    hasPermission = false;
  }

  if (!hasPermission) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this page. Required role: {
              requireSuperAdmin ? "Super Admin" :
              requireAdmin ? "Admin" :
              requireModerator ? "Moderator" :
              requiredRole ? requiredRole.replace('_', ' ') : "Unknown"
            }
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}