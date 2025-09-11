import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database['public']['Enums']['app_role'];

interface UseRolesReturn {
  roles: AppRole[];
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  refreshRoles: () => Promise<void>;
}

export function useRoles(): UseRolesReturn {
  const { user, originalUser, isImpersonating } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async () => {
    // When impersonating, use the original user's roles for permission checks
    const userForRoles = isImpersonating ? originalUser : user;
    
    if (!userForRoles) {
      setRoles([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userForRoles.id);

      if (error) {
        console.error("Error fetching user roles:", error);
        setRoles([]);
      } else {
        setRoles(data?.map(r => r.role) || []);
      }
    } catch (error) {
      console.error("Error fetching user roles:", error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, [user, originalUser, isImpersonating]);

  const hasRole = (role: AppRole): boolean => {
    return roles.includes(role);
  };

  const isSuperAdmin = hasRole('super_admin');
  const isAdmin = hasRole('admin') || isSuperAdmin;
  const isModerator = hasRole('moderator') || isAdmin;

  return {
    roles,
    loading,
    hasRole,
    isSuperAdmin,
    isAdmin,
    isModerator,
    refreshRoles: fetchRoles,
  };
}