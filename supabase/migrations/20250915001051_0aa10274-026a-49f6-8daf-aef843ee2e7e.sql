-- Grant email_management module to all existing users who don't have it
INSERT INTO public.user_modules (user_id, module, granted_by, granted_at)
SELECT 
  p.id as user_id,
  'email_management' as module,
  p.id as granted_by,
  now() as granted_at
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.user_modules um 
  WHERE um.user_id = p.id 
  AND um.module = 'email_management'
)
ON CONFLICT (user_id, module) DO NOTHING;

-- Update the trigger function to ensure it always grants email_management
CREATE OR REPLACE FUNCTION public.grant_default_modules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Grant email_management module to all new users by default
  INSERT INTO public.user_modules (user_id, module, granted_by, granted_at)
  VALUES (NEW.id, 'email_management', NEW.id, now())
  ON CONFLICT (user_id, module) DO NOTHING;
  
  RETURN NEW;
END;
$$;