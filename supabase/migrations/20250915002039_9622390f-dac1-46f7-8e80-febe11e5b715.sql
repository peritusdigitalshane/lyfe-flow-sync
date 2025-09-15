-- Fix the threat intelligence access function to properly check Security module
CREATE OR REPLACE FUNCTION public.has_threat_intelligence_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Check if user has security module access
  SELECT EXISTS (
    SELECT 1
    FROM public.user_modules
    WHERE user_id = _user_id
      AND module = 'security'
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- Add helper function to check module access generically
CREATE OR REPLACE FUNCTION public.user_has_module_access(_user_id uuid, _module user_module)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_modules
    WHERE user_id = _user_id
      AND module = _module
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;