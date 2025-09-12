-- Update threat intelligence feeds with real working feeds
UPDATE threat_intelligence_feeds SET 
  feed_url = 'https://malware-filter.gitlab.io/malware-filter/phishing-filter.txt',
  api_endpoint = null,
  description = 'Community-maintained phishing domain blocklist'
WHERE name = 'PhishTank Database' AND is_preconfigured = true;

UPDATE threat_intelligence_feeds SET 
  feed_url = 'https://urlhaus.abuse.ch/downloads/text/',
  api_endpoint = null,
  description = 'URLhaus malware URL feed from abuse.ch'
WHERE name = 'URLhaus Malware URLs' AND is_preconfigured = true;

UPDATE threat_intelligence_feeds SET 
  feed_url = 'https://feodotracker.abuse.ch/downloads/ipblocklist.txt',
  api_endpoint = null,
  description = 'Feodo Tracker botnet IP blocklist from abuse.ch'
WHERE name = 'Feodo Tracker IPs' AND is_preconfigured = true;

UPDATE threat_intelligence_feeds SET 
  feed_url = 'https://www.spamhaus.org/drop/drop.txt',
  api_endpoint = null,
  description = 'Spamhaus DROP (Don\'t Route Or Peer) list'
WHERE name = 'Spamhaus DROP List' AND is_preconfigured = true;

UPDATE threat_intelligence_feeds SET 
  feed_url = 'https://reputation.alienvault.com/reputation.data',
  api_endpoint = null,
  description = 'AlienVault IP reputation data'
WHERE name = 'AlienVault IP Reputation' AND is_preconfigured = true;

-- Add some additional high-quality free feeds
INSERT INTO threat_intelligence_feeds (
  name, description, feed_type, feed_url, is_active, is_preconfigured, 
  api_key_required, update_frequency_hours
) VALUES 
('Malware Domain List', 'High-confidence malware domains', 'domain_blocklist', 'https://www.malwaredomainlist.com/hostslist/hosts.txt', true, true, false, 6),
('SURBL Multi', 'SURBL reputation data for domains in spam', 'domain_reputation', 'http://www.surbl.org/guidelines', true, true, false, 12),
('DNS-BH Malware Domains', 'DNS-BH malware domain blocklist', 'domain_blocklist', 'http://mirror1.malwaredomains.com/files/domains.txt', true, true, false, 12),
('Emerging Threats IPs', 'Emerging Threats compromised IP list', 'ip_blocklist', 'https://rules.emergingthreats.net/fwrules/emerging-Block-IPs.txt', true, true, false, 6),
('Bambenek C2 Domains', 'Bambenek Consulting C2 domain feed', 'domain_blocklist', 'http://osint.bambenekconsulting.com/feeds/c2-dommasterlist.txt', true, true, false, 12),
('ThreatFox IOCs', 'ThreatFox Indicators of Compromise', 'url_blocklist', 'https://threatfox.abuse.ch/export/json/recent/', true, true, false, 2);

-- Add VirusTotal API integration (requires API key)
INSERT INTO threat_intelligence_feeds (
  name, description, feed_type, api_endpoint, is_active, is_preconfigured, 
  api_key_required, update_frequency_hours
) VALUES 
('VirusTotal Domain Reputation', 'VirusTotal domain reputation checking', 'domain_reputation', 'https://www.virustotal.com/api/v3', false, true, true, 1);