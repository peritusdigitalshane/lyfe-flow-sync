-- Fix the security issue with the function by properly setting search_path
CREATE OR REPLACE FUNCTION public.activate_user_account(user_email TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update profile status to active
  UPDATE public.profiles 
  SET account_status = 'active'
  FROM auth.users 
  WHERE auth.users.id = profiles.id 
    AND auth.users.email = user_email;
    
  -- Update subscriber record
  UPDATE public.subscribers 
  SET subscribed = true,
      updated_at = now()
  WHERE email = user_email;
END;
$$;