import { useAuth } from "./useAuth";

/**
 * Hook that provides the correct user context for data operations.
 * When impersonating, returns the impersonated user's data.
 * When not impersonating, returns the current user's data.
 * This should be used for data fetching operations to show the right user's data.
 */
export function useUserContext() {
  const { user, isImpersonating } = useAuth();
  
  return {
    /** The user whose data should be displayed (impersonated user or current user) */
    contextUser: user,
    /** Whether we are currently viewing someone else's data */
    isViewingOtherUser: isImpersonating,
  };
}