-- Create a helper function to check if a user has threat intelligence access
CREATE OR REPLACE FUNCTION public.has_threat_intelligence_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if user has security_analyst role or is admin/super_admin
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('security_analyst', 'admin', 'super_admin')
  )
$$;