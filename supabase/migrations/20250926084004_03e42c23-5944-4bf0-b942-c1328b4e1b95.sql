-- Create trigger to automatically grant email_management module to all new users
CREATE TRIGGER on_auth_user_created_grant_modules
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_default_modules();

-- Also grant email_management module to all existing users who don't have it
INSERT INTO public.user_modules (user_id, module, granted_by, granted_at)
SELECT 
  p.id,
  'email_management'::user_module,
  p.id,
  now()
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_modules um 
  WHERE um.user_id = p.id AND um.module = 'email_management'
)
ON CONFLICT (user_id, module) DO NOTHING;