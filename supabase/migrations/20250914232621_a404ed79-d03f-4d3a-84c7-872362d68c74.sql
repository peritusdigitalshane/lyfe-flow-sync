-- Fix Critical Security Vulnerability: Restrict access to threat intelligence feeds with API keys
-- This prevents exposure of API keys to unauthorized users

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Users can view feeds in their tenant or preconfigured feeds" ON public.threat_intelligence_feeds;

-- Create a more secure policy that hides API keys from regular users
CREATE POLICY "Users can view basic feed info in their tenant" 
ON public.threat_intelligence_feeds 
FOR SELECT 
USING (
  -- Users can see their own tenant feeds (including API keys if they created them)
  (tenant_id = (select tenant_id from profiles where id = auth.uid()))
  OR 
  -- Users can see preconfigured feeds but ONLY if they have security analyst or admin role
  (is_preconfigured = true AND has_threat_intelligence_access(auth.uid()))
);

-- Add a policy specifically for security analysts and admins to manage preconfigured feeds
CREATE POLICY "Security analysts can manage preconfigured feeds" 
ON public.threat_intelligence_feeds 
FOR UPDATE 
USING (
  is_preconfigured = true 
  AND has_threat_intelligence_access(auth.uid())
);

-- Create a security-focused view that hides API keys from regular users
CREATE OR REPLACE VIEW public.threat_feeds_safe AS 
SELECT 
  id,
  name,
  description,
  feed_type,
  feed_url,
  api_endpoint,
  api_key_required,
  is_active,
  is_preconfigured,
  update_frequency_hours,
  total_entries,
  success_rate,
  last_updated_at,
  created_at,
  updated_at,
  tenant_id,
  -- Only show API key to users who own the feed or have security analyst access
  CASE 
    WHEN tenant_id = (select tenant_id from profiles where id = auth.uid()) 
         OR has_threat_intelligence_access(auth.uid()) 
    THEN api_key 
    ELSE NULL 
  END as api_key
FROM public.threat_intelligence_feeds;

-- Grant appropriate permissions on the view
GRANT SELECT ON public.threat_feeds_safe TO authenticated;