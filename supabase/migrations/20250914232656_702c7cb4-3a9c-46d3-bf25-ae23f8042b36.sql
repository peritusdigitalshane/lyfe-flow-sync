-- Fix the SECURITY DEFINER view issue and improve the threat intelligence security
-- Remove the problematic view and replace with a safer approach

-- Drop the problematic view
DROP VIEW IF EXISTS public.threat_feeds_safe;

-- Create a security function to check if user can see API keys
CREATE OR REPLACE FUNCTION public.can_see_threat_feed_api_key(feed_tenant_id uuid, feed_is_preconfigured boolean)
RETURNS boolean 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- User can see API keys for their own tenant feeds
    feed_tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    OR 
    -- Security analysts/admins can see preconfigured feed API keys
    (feed_is_preconfigured = true AND has_threat_intelligence_access(auth.uid()))
  )
$$;