-- Create the missing activate_user_account function used by Stripe webhook
CREATE OR REPLACE FUNCTION public.activate_user_account(user_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update profile status to active
  UPDATE public.profiles 
  SET account_status = 'active',
      updated_at = now()
  WHERE email = user_email;
    
  -- Update or create subscriber record
  INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier, updated_at)
  SELECT p.id, user_email, true, 'stripe', now()
  FROM public.profiles p
  WHERE p.email = user_email
  ON CONFLICT (email) 
  DO UPDATE SET 
    subscribed = true,
    subscription_tier = 'stripe',
    updated_at = now();
END;
$$;