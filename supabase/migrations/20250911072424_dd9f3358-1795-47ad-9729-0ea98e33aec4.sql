-- Add account status tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN account_status TEXT DEFAULT 'pending' CHECK (account_status IN ('pending', 'active', 'suspended'));

-- Add index for better performance
CREATE INDEX idx_profiles_account_status ON public.profiles(account_status);

-- Update existing profiles to be active (for existing users)
UPDATE public.profiles SET account_status = 'active' WHERE account_status IS NULL;

-- Create a function to handle successful payments
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