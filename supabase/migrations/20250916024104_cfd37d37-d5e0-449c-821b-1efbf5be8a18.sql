-- Fix Alienvault threat intelligence feeds configuration issues

-- Remove the misconfigured feed with email as API endpoint
DELETE FROM threat_intelligence_feeds 
WHERE id = '4c2610bb-7838-4a14-8b86-37b49e4c98ba' 
  AND api_endpoint = 'cameron.bull@peritusdigital.com.au';

-- Update the remaining Alienvault OTX feed with proper configuration
UPDATE threat_intelligence_feeds 
SET 
  feed_url = 'https://otx.alienvault.com/api/v1',
  api_endpoint = 'https://otx.alienvault.com/api/v1',
  description = 'AlienVault Open Threat Exchange (OTX) provides crowd-sourced threat intelligence including domains, URLs, IPs, and file hashes from security researchers worldwide.',
  updated_at = now()
WHERE name = 'Alienvault' 
  AND feed_type = 'otx_indicators';