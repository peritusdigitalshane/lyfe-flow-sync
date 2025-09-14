-- Fix user role assignment - new users should only get 'user' role
-- Remove automatic admin assignment and ensure proper role control

-- Drop and recreate the user role assignment function
DROP FUNCTION IF EXISTS public.handle_new_user_role();

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Assign ONLY default 'user' role to new user
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (NEW.id, 'user', NEW.id);
  
  -- Removed automatic admin assignment - all elevated roles must be assigned manually by super admins
  
  RETURN NEW;
END;
$$;