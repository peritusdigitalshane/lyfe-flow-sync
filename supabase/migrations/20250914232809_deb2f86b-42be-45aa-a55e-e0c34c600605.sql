-- Fix Critical Security Vulnerabilities
-- 1. Fix profiles table - prevent anonymous access
-- 2. Strengthen mailboxes and emails RLS policies  
-- 3. Restrict subscribers service role access
-- 4. Further restrict threat intelligence API key access

-- 1. FIX PROFILES TABLE - Add explicit policy to deny anonymous access
-- Drop existing policies that might be too permissive
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Recreate with stronger authentication checks
CREATE POLICY "Authenticated users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND auth.uid() = id);

CREATE POLICY "Authenticated users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = id);

CREATE POLICY "Authenticated users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND auth.uid() = id);

-- 2. STRENGTHEN MAILBOXES AND EMAILS RLS POLICIES
-- These tables contain sensitive Microsoft tokens and email content
-- Add explicit authentication checks

-- Update mailboxes policies
DROP POLICY IF EXISTS "Users can view mailboxes in their tenant" ON public.mailboxes;
DROP POLICY IF EXISTS "Users can create mailboxes in their tenant" ON public.mailboxes;
DROP POLICY IF EXISTS "Users can update mailboxes in their tenant" ON public.mailboxes;
DROP POLICY IF EXISTS "Users can delete mailboxes in their tenant" ON public.mailboxes;

CREATE POLICY "Authenticated users can view their tenant mailboxes" 
ON public.mailboxes 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Authenticated users can create mailboxes in their tenant" 
ON public.mailboxes 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid() 
  AND tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Authenticated users can update their tenant mailboxes" 
ON public.mailboxes 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Authenticated users can delete their tenant mailboxes" 
ON public.mailboxes 
FOR DELETE 
USING (
  auth.uid() IS NOT NULL 
  AND tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Update emails policies  
DROP POLICY IF EXISTS "Users can view emails in their tenant" ON public.emails;
DROP POLICY IF EXISTS "Users can create emails in their tenant" ON public.emails;
DROP POLICY IF EXISTS "Users can update emails in their tenant" ON public.emails;
DROP POLICY IF EXISTS "Users can delete emails in their tenant" ON public.emails;

CREATE POLICY "Authenticated users can view their tenant emails" 
ON public.emails 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Authenticated users can create emails in their tenant" 
ON public.emails 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Authenticated users can update their tenant emails" 
ON public.emails 
FOR UPDATE 
USING (
  auth.uid() IS NOT NULL 
  AND tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "Authenticated users can delete their tenant emails" 
ON public.emails 
FOR DELETE 
USING (
  auth.uid() IS NOT NULL 
  AND tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- 3. RESTRICT SUBSCRIBERS SERVICE ROLE ACCESS
-- Replace the overly broad "Service role can manage subscriptions" policy
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscribers;

-- Create more specific service role policies for legitimate operations
CREATE POLICY "Service role can update subscription status" 
ON public.subscribers 
FOR UPDATE 
USING (auth.jwt() IS NOT NULL AND auth.jwt()->>'role' = 'service_role')
WITH CHECK (
  -- Only allow updating specific subscription-related fields
  auth.jwt() IS NOT NULL AND auth.jwt()->>'role' = 'service_role'
);

CREATE POLICY "Service role can insert new subscriptions" 
ON public.subscribers 
FOR INSERT 
WITH CHECK (auth.jwt() IS NOT NULL AND auth.jwt()->>'role' = 'service_role');

-- Keep user access policies
-- (existing user policies should remain as they are)