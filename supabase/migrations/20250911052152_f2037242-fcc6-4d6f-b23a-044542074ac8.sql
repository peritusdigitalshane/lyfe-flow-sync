-- Remove ALL the problematic tenant-scoped policies for now to restore functionality
DROP POLICY IF EXISTS "Admins can view profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Admins can create profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their tenant" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view roles in their tenant" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles in their tenant" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles in their tenant" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles in their tenant" ON public.user_roles;

-- Also drop the function that might be causing issues
DROP FUNCTION IF EXISTS public.get_current_user_tenant_id();