import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { UserX, X } from "lucide-react";
import { toast } from "sonner";

export function ImpersonationBanner() {
  const { isImpersonating, user, originalUser, stopImpersonating, loading } = useAuth();

  // Don't render anything while auth is loading
  if (loading) {
    return null;
  }

  const handleStopImpersonating = () => {
    stopImpersonating();
    toast.success("Stopped impersonating user. Returned to your account.");
  };

  if (!isImpersonating) {
    return null;
  }

  return (
    <div className="bg-orange-100 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <UserX className="h-4 w-4 text-orange-600" />
            <span className="text-sm text-orange-700 dark:text-orange-400 font-medium">
              You are viewing <span className="font-bold">{user?.email}</span>'s account
            </span>
            <span className="text-xs text-orange-600 dark:text-orange-500 bg-orange-200 dark:bg-orange-800 px-2 py-1 rounded">
              Admin: {originalUser?.email}
            </span>
          </div>
          <Button 
            onClick={handleStopImpersonating}
            variant="ghost" 
            size="sm" 
            className="text-orange-600 hover:text-orange-700 hover:bg-orange-200 dark:hover:bg-orange-800 gap-2"
          >
            <X className="h-3 w-3" />
            Exit Impersonation
          </Button>
        </div>
      </div>
    </div>
  );
}