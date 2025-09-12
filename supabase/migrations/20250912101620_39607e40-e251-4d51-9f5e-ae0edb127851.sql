-- Create threat intelligence feeds table
CREATE TABLE public.threat_intelligence_feeds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  feed_type TEXT NOT NULL CHECK (feed_type IN ('domain_blocklist', 'url_blocklist', 'ip_blocklist', 'hash_blocklist', 'reputation_check', 'phishing_check')),
  feed_url TEXT,
  api_endpoint TEXT,
  api_key_required BOOLEAN DEFAULT false,
  api_key TEXT,
  update_frequency_hours INTEGER DEFAULT 24,
  is_active BOOLEAN DEFAULT true,
  is_preconfigured BOOLEAN DEFAULT false,
  description TEXT,
  tenant_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_updated_at TIMESTAMP WITH TIME ZONE,
  total_entries INTEGER DEFAULT 0,
  success_rate NUMERIC(5,2) DEFAULT 100.0
);

-- Enable RLS
ALTER TABLE public.threat_intelligence_feeds ENABLE ROW LEVEL SECURITY;

-- Create policies for threat intelligence feeds
CREATE POLICY "Users can view feeds in their tenant or preconfigured feeds" 
ON public.threat_intelligence_feeds 
FOR SELECT 
USING (
  tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()) 
  OR is_preconfigured = true
);

CREATE POLICY "Users can create feeds in their tenant" 
ON public.threat_intelligence_feeds 
FOR INSERT 
WITH CHECK (
  tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  AND is_preconfigured = false
);

CREATE POLICY "Users can update feeds in their tenant" 
ON public.threat_intelligence_feeds 
FOR UPDATE 
USING (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can delete feeds in their tenant" 
ON public.threat_intelligence_feeds 
FOR DELETE 
USING (
  tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  AND is_preconfigured = false
);

-- Create threat intelligence results table
CREATE TABLE public.threat_intelligence_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id UUID NOT NULL,
  feed_id UUID NOT NULL REFERENCES public.threat_intelligence_feeds(id) ON DELETE CASCADE,
  threat_type TEXT NOT NULL,
  threat_indicator TEXT NOT NULL,
  threat_score INTEGER NOT NULL CHECK (threat_score >= 0 AND threat_score <= 100),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tenant_id UUID NOT NULL
);

-- Enable RLS for results
ALTER TABLE public.threat_intelligence_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view threat results in their tenant" 
ON public.threat_intelligence_results 
FOR SELECT 
USING (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can create threat results in their tenant" 
ON public.threat_intelligence_results 
FOR INSERT 
WITH CHECK (tenant_id = (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

-- Add indexes for performance
CREATE INDEX idx_threat_feeds_tenant_active ON public.threat_intelligence_feeds(tenant_id, is_active);
CREATE INDEX idx_threat_feeds_preconfigured ON public.threat_intelligence_feeds(is_preconfigured, is_active);
CREATE INDEX idx_threat_results_email ON public.threat_intelligence_results(email_id);
CREATE INDEX idx_threat_results_tenant ON public.threat_intelligence_results(tenant_id);

-- Insert pre-configured threat intelligence feeds
INSERT INTO public.threat_intelligence_feeds (
  name, feed_type, feed_url, description, is_preconfigured, is_active, update_frequency_hours
) VALUES 
(
  'Malware Domain List', 
  'domain_blocklist', 
  'https://www.malwaredomainlist.com/hostslist/hosts.txt',
  'Community-driven list of malware domains updated regularly',
  true, 
  true, 
  6
),
(
  'PhishTank', 
  'phishing_check', 
  'http://data.phishtank.com/data/online-valid.csv',
  'Collaborative anti-phishing database with verified phishing URLs',
  true, 
  true, 
  2
),
(
  'URLhaus Malware URLs', 
  'url_blocklist', 
  'https://urlhaus.abuse.ch/downloads/csv_recent/',
  'Recent malware URLs from abuse.ch URLhaus project',
  true, 
  true, 
  1
),
(
  'Feodo Tracker', 
  'ip_blocklist', 
  'https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.txt',
  'IP addresses of Feodo (Emotet/TrickBot) C&C servers',
  true, 
  true, 
  4
),
(
  'Spamhaus DROP', 
  'ip_blocklist', 
  'https://www.spamhaus.org/drop/drop.txt',
  'Spamhaus Don''t Route Or Peer list of netblocks',
  true, 
  true, 
  24
),
(
  'SURBL Multi', 
  'domain_blocklist', 
  'https://www.surbl.org/guidelines',
  'SURBL reputation database for spam domains (requires API key)',
  true, 
  false, 
  12
),
(
  'DNS-BH Malware Domains', 
  'domain_blocklist', 
  'http://www.malwaredomains.com/files/domains.txt',
  'Malware domain blocklist maintained by DNS-BH project',
  true, 
  true, 
  12
),
(
  'Emerging Threats Compromised IPs', 
  'ip_blocklist', 
  'https://rules.emergingthreats.net/fwrules/emerging-Block-IPs.txt',
  'Known compromised or malicious IP addresses',
  true, 
  true, 
  6
);

-- Add trigger for updated_at
CREATE TRIGGER update_threat_feeds_updated_at
BEFORE UPDATE ON public.threat_intelligence_feeds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();