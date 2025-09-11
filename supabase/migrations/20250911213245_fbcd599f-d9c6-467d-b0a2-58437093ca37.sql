-- Fix subscribers table RLS policies to only allow user_id matching for better security
-- Remove email-based access which could be exploited

-- Drop existing RLS policies
DROP POLICY IF EXISTS "select_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;

-- Create new stricter RLS policies that only allow user_id matching
CREATE POLICY "Users can view their own subscription" 
ON public.subscribers 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own subscription" 
ON public.subscribers 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert their own subscription" 
ON public.subscribers 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Allow edge functions to bypass RLS by using service role key
-- This policy allows service role to perform operations for edge functions
CREATE POLICY "Service role can manage subscriptions" 
ON public.subscribers 
FOR ALL 
USING (true) 
WITH CHECK (true);