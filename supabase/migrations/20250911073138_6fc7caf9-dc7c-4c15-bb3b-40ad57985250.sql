-- Fix critical security vulnerability: Restrict subscription updates to own records only
DROP POLICY IF EXISTS "update_own_subscription" ON public.subscribers;

-- Create a proper restrictive update policy
CREATE POLICY "update_own_subscription" ON public.subscribers
FOR UPDATE
USING ((user_id = auth.uid()) OR (email = auth.email()));

-- Also fix the overly permissive insert policy for better security
DROP POLICY IF EXISTS "insert_subscription" ON public.subscribers;

-- Create a restrictive insert policy that only allows users to create their own subscription records
CREATE POLICY "insert_subscription" ON public.subscribers
FOR INSERT
WITH CHECK ((user_id = auth.uid()) OR (email = auth.email()));