-- Update RLS policies to allow admins to manage users within their tenant

-- Allow admins to view profiles in their tenant
CREATE POLICY "Admins can view profiles in their tenant" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- Allow admins to create profiles in their tenant
CREATE POLICY "Admins can create profiles in their tenant" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND 
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- Allow admins to update profiles in their tenant
CREATE POLICY "Admins can update profiles in their tenant" 
ON public.profiles 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

-- Allow admins to view roles in their tenant (need to check user's tenant through profiles)
CREATE POLICY "Admins can view roles in their tenant" 
ON public.user_roles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) AND 
  user_id IN (
    SELECT id FROM public.profiles 
    WHERE tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  )
);

-- Allow admins to manage roles in their tenant (but not super_admin roles)
CREATE POLICY "Admins can manage roles in their tenant" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND 
  role != 'super_admin'::app_role AND
  user_id IN (
    SELECT id FROM public.profiles 
    WHERE tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
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
    WHERE tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
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
    WHERE tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  )
);