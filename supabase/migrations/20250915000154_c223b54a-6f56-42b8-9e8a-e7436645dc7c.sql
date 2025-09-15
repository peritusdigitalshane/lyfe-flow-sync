-- Create modules enum for the platform
CREATE TYPE public.user_module AS ENUM ('email_management', 'security');

-- Create user_modules table to track which modules users have access to
CREATE TABLE public.user_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  module user_module NOT NULL,
  granted_by UUID REFERENCES profiles(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, module)
);

-- Enable RLS on user_modules
ALTER TABLE public.user_modules ENABLE ROW LEVEL SECURITY;

-- Users can view their own modules
CREATE POLICY "Users can view their own modules"
ON public.user_modules
FOR SELECT
USING (user_id = auth.uid());

-- Admins and super admins can view all modules
CREATE POLICY "Admins can view all modules"
ON public.user_modules
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Super admins can manage all modules
CREATE POLICY "Super admins can manage modules"
ON public.user_modules
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Admins can grant modules to users in their tenant
CREATE POLICY "Admins can grant modules"
ON public.user_modules
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) AND
  user_id IN (SELECT id FROM profiles WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
);

-- Admins can update modules for users in their tenant
CREATE POLICY "Admins can update modules"
ON public.user_modules
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) AND
  user_id IN (SELECT id FROM profiles WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()))
);

-- Create function to check if user has module access
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id UUID, _module user_module)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
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

-- Create function to automatically grant email_management module to new users
CREATE OR REPLACE FUNCTION public.grant_default_modules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Grant email_management module to all new users by default
  INSERT INTO public.user_modules (user_id, module, granted_by)
  VALUES (NEW.id, 'email_management', NEW.id);
  
  RETURN NEW;
END;
$$;

-- Create trigger to grant default modules on user creation
CREATE TRIGGER grant_default_modules_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_default_modules();

-- Add trigger for updated_at
CREATE TRIGGER update_user_modules_updated_at
  BEFORE UPDATE ON public.user_modules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();