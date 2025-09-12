-- Fix the existing feeds with working URLs and proper descriptions
UPDATE threat_intelligence_feeds SET 
  feed_url = 'https://malware-filter.gitlab.io/malware-filter/phishing-filter-hosts.txt',
  description = 'Community-maintained phishing domain blocklist from malware-filter project'
WHERE name = 'PhishTank' AND is_preconfigured = true;

UPDATE threat_intelligence_feeds SET 
  feed_url = 'https://urlhaus.abuse.ch/downloads/text_recent/',
  description = 'URLhaus malware URL feed from abuse.ch - recent malicious URLs'
WHERE name = 'URLhaus Malware URLs' AND is_preconfigured = true;

UPDATE threat_intelligence_feeds SET 
  feed_url = 'https://feodotracker.abuse.ch/downloads/ipblocklist.txt',
  description = 'Feodo Tracker botnet IP blocklist from abuse.ch'
WHERE name = 'Feodo Tracker' AND is_preconfigured = true;

UPDATE threat_intelligence_feeds SET 
  feed_url = 'https://www.spamhaus.org/drop/drop.txt',
  description = 'Spamhaus DROP (Do not Route Or Peer) list'
WHERE name = 'Spamhaus DROP' AND is_preconfigured = true;

-- Add additional high-quality free feeds from awesome-threat-intelligence
INSERT INTO threat_intelligence_feeds (
  name, description, feed_type, feed_url, is_active, is_preconfigured, 
  api_key_required, update_frequency_hours
) VALUES 
('Abuse.ch SSL Blacklist', 'SSL certificates used by malware C&C servers', 'domain_blocklist', 'https://sslbl.abuse.ch/blacklist/sslblacklist.csv', true, true, false, 12),
('Bambenek C2 Domains', 'Bambenek Consulting C&C domain feed', 'domain_blocklist', 'http://osint.bambenekconsulting.com/feeds/c2-dommasterlist.txt', true, true, false, 12),
('CERT-PA Malware Domains', 'Italian CERT malware domain list', 'domain_blocklist', 'https://infosec.cert-pa.it/analyze/listdomains.txt', true, true, false, 24),
('Malware Domain Blocklist', 'RiskIQ malware domain blocklist', 'domain_blocklist', 'https://www.malwaredomainblocklist.com/hostslist/hosts.txt', true, true, false, 12),
('Cybercrime Tracker', 'Cybercrime tracker C&C list', 'url_blocklist', 'http://cybercrime-tracker.net/all.php', true, true, false, 6);

-- Add VirusTotal API integration (disabled by default, requires API key)
INSERT INTO threat_intelligence_feeds (
  name, description, feed_type, api_endpoint, is_active, is_preconfigured, 
  api_key_required, update_frequency_hours
) VALUES 
('VirusTotal Domain Check', 'VirusTotal domain reputation API', 'domain_reputation', 'https://www.virustotal.com/api/v3', false, true, true, 1);