-- Add real working threat intelligence feeds with correct feed types
INSERT INTO threat_intelligence_feeds (
  name, description, feed_type, feed_url, is_active, is_preconfigured, 
  api_key_required, update_frequency_hours
) VALUES 
('Abuse.ch SSL Blacklist', 'SSL certificates used by malware C&C servers', 'domain_blocklist', 'https://sslbl.abuse.ch/blacklist/sslblacklist.csv', true, true, false, 12),
('Bambenek C2 Domains', 'Bambenek Consulting C&C domain feed', 'domain_blocklist', 'http://osint.bambenekconsulting.com/feeds/c2-dommasterlist.txt', true, true, false, 12),
('CERT-PA Malware Domains', 'Italian CERT malware domain list', 'domain_blocklist', 'https://infosec.cert-pa.it/analyze/listdomains.txt', true, true, false, 24),
('Cybercrime Tracker', 'Cybercrime tracker C&C URLs', 'url_blocklist', 'http://cybercrime-tracker.net/all.php', true, true, false, 6),
('OpenPhish URLs', 'OpenPhish phishing URL feed', 'phishing_check', 'https://openphish.com/feed.txt', true, true, false, 1),
('Botvrij.eu Domains', 'Dutch botvrij.eu malware domain feed', 'domain_blocklist', 'https://www.botvrij.eu/data/feed-suspicious', true, true, false, 12);

-- Update existing feeds with working URLs
UPDATE threat_intelligence_feeds SET 
  feed_url = 'https://openphish.com/feed.txt',
  description = 'OpenPhish phishing URL database - real-time phishing URLs'
WHERE name = 'PhishTank' AND is_preconfigured = true;

UPDATE threat_intelligence_feeds SET 
  feed_url = 'https://urlhaus.abuse.ch/downloads/text_recent/',
  description = 'URLhaus recent malicious URLs from abuse.ch'
WHERE name = 'URLhaus Malware URLs' AND is_preconfigured = true;