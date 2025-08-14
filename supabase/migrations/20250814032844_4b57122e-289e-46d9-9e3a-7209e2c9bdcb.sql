-- First, ensure all existing users have the basic 'user' role
INSERT INTO public.user_roles (user_id, role, created_by)
SELECT p.id, 'user'::app_role, p.id
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = p.id AND ur.role = 'user'
);

-- Assign super_admin role to shane.stephens@peritusdigital.com.au
INSERT INTO public.user_roles (user_id, role, created_by)
SELECT p.id, 'super_admin'::app_role, p.id
FROM profiles p
WHERE p.email = 'shane.stephens@peritusdigital.com.au'
AND NOT EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = p.id AND ur.role = 'super_admin'
);