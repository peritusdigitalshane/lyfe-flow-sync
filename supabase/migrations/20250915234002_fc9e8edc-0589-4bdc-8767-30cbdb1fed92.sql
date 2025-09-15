-- Add the new AlienVault OTX feed type to the existing check constraint
ALTER TABLE public.threat_intelligence_feeds 
DROP CONSTRAINT IF EXISTS threat_intelligence_feeds_feed_type_check;

-- Re-create the constraint with the new feed type included
ALTER TABLE public.threat_intelligence_feeds 
ADD CONSTRAINT threat_intelligence_feeds_feed_type_check 
CHECK (feed_type IN (
  'domain_blocklist', 
  'url_blocklist', 
  'ip_blocklist', 
  'hash_blocklist', 
  'reputation_check', 
  'phishing_check',
  'otx_indicators',
  'domain_reputation'
));