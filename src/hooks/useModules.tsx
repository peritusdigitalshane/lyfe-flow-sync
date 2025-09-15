import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Database } from "@/integrations/supabase/types";

type UserModule = Database['public']['Enums']['user_module'];

interface UserModuleAccess {
  id: string;
  module: UserModule;
  is_active: boolean;
  expires_at?: string;
  granted_at: string;
}

interface UseModulesReturn {
  modules: UserModule[];
  moduleAccess: UserModuleAccess[];
  loading: boolean;
  hasModuleAccess: (module: UserModule) => boolean;
  hasEmailManagement: boolean;
  hasSecurity: boolean;
  refreshModules: () => Promise<void>;
}

export function useModules(): UseModulesReturn {
  const { user, originalUser, isImpersonating } = useAuth();
  const [modules, setModules] = useState<UserModule[]>([]);
  const [moduleAccess, setModuleAccess] = useState<UserModuleAccess[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModules = async () => {
    // When impersonating, use the original user's modules for permission checks
    const userForModules = isImpersonating ? originalUser : user;
    
    if (!userForModules) {
      setModules([]);
      setModuleAccess([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_modules")
        .select("*")
        .eq("user_id", userForModules.id)
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching user modules:", error);
        setModules([]);
        setModuleAccess([]);
      } else {
        const validModules = data?.filter(m => 
          !m.expires_at || new Date(m.expires_at) > new Date()
        ) || [];
        
        setModuleAccess(validModules);
        setModules(validModules.map(m => m.module));
      }
    } catch (error) {
      console.error("Error fetching user modules:", error);
      setModules([]);
      setModuleAccess([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, [user, originalUser, isImpersonating]);

  const hasModuleAccess = (module: UserModule): boolean => {
    return modules.includes(module);
  };

  const hasEmailManagement = hasModuleAccess('email_management');
  const hasSecurity = hasModuleAccess('security');

  return {
    modules,
    moduleAccess,
    loading,
    hasModuleAccess,
    hasEmailManagement,
    hasSecurity,
    refreshModules: fetchModules,
  };
}