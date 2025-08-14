-- Add super_admin role to the enum
ALTER TYPE public.app_role ADD VALUE 'super_admin';

-- Update the has_role function to handle super_admin
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- Update RLS policies for app_settings to use super_admin instead of admin
DROP POLICY "Admins can view app settings" ON public.app_settings;
DROP POLICY "Admins can create app settings" ON public.app_settings;
DROP POLICY "Admins can update app settings" ON public.app_settings;
DROP POLICY "Admins can delete app settings" ON public.app_settings;

CREATE POLICY "Super admins can view app settings" 
ON public.app_settings 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can create app settings" 
ON public.app_settings 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can update app settings" 
ON public.app_settings 
FOR UPDATE 
USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete app settings" 
ON public.app_settings 
FOR DELETE 
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Assign super_admin role to the specific email
-- First we need to find the user_id for shane.stephens@peritusdigital.com.au
-- We'll use a function to handle this safely
CREATE OR REPLACE FUNCTION assign_super_admin_to_email(target_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    target_user_id uuid;
BEGIN
    -- Find the user_id from profiles table
    SELECT id INTO target_user_id
    FROM public.profiles
    WHERE email = target_email;
    
    -- If user exists, assign super_admin role
    IF target_user_id IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role, created_by)
        VALUES (target_user_id, 'super_admin', target_user_id)
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END;
$$;

-- Call the function to assign super_admin role
SELECT assign_super_admin_to_email('shane.stephens@peritusdigital.com.au');

-- Clean up the temporary function
DROP FUNCTION assign_super_admin_to_email(TEXT);