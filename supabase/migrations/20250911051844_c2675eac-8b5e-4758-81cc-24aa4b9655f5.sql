-- Fix infinite recursion by dropping problematic policies and creating security definer functions

-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admins can view profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Admins can create profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view roles in their tenant" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles in their tenant" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles in their tenant" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles in their tenant" ON public.user_roles;

-- Create security definer function to get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_current_user_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Recreate policies using the security definer function to avoid recursion
CREATE POLICY "Admins can view profiles in their tenant" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  tenant_id = public.get_current_user_tenant_id()
);

CREATE POLICY "Admins can create profiles in their tenant" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND 
  tenant_id = public.get_current_user_tenant_id()
);

CREATE POLICY "Admins can update profiles in their tenant" 
ON public.profiles 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  tenant_id = public.get_current_user_tenant_id()
);

-- For user_roles, we need to check if the target user is in the same tenant
CREATE POLICY "Admins can view roles in their tenant" 
ON public.user_roles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  user_id IN (
    SELECT id FROM public.profiles 
    WHERE tenant_id = public.get_current_user_tenant_id()
  )
);

CREATE POLICY "Admins can manage roles in their tenant" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND 
  role != 'super_admin'::app_role AND
  user_id IN (
    SELECT id FROM public.profiles 
    WHERE tenant_id = public.get_current_user_tenant_id()
  )
);

CREATE POLICY "Admins can update roles in their tenant" 
ON public.user_roles 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  role != 'super_admin'::app_role AND
  user_id IN (
    SELECT id FROM public.profiles 
    WHERE tenant_id = public.get_current_user_tenant_id()
  )
);

CREATE POLICY "Admins can delete roles in their tenant" 
ON public.user_roles 
FOR DELETE 
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  role != 'super_admin'::app_role AND
  user_id IN (
    SELECT id FROM public.profiles 
    WHERE tenant_id = public.get_current_user_tenant_id()
  )
);