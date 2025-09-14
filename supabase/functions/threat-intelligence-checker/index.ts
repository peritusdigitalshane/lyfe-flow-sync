import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ThreatCheckRequest {
  email_id: string;
  email_content: {
    subject: string;
    sender_email: string;
    body_content?: string;
    body_preview?: string;
  };
  tenant_id: string;
}

interface ThreatCheckResult {
  threats_detected: number;
  max_threat_score: number;
  threat_details: Array<{
    feed_name: string;
    threat_type: string;
    threat_indicator: string;
    threat_score: number;
    details: any;
  }>;
  should_quarantine: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email_id, email_content, tenant_id }: ThreatCheckRequest = await req.json();

    if (!email_id || !email_content || !tenant_id) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: email_id, email_content, tenant_id' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Starting threat intelligence check for email: ${email_id}`);

    // First, check if the tenant has users with threat intelligence access
    const { data: email, error: emailError } = await supabase
      .from('emails')
      .select('mailbox_id')
      .eq('id', email_id)
      .single();

    if (emailError) {
      console.error('Error fetching email:', emailError);
      throw emailError;
    }

    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('user_id')
      .eq('id', email.mailbox_id)
      .single();

    if (mailboxError) {
      console.error('Error fetching mailbox:', mailboxError);
      throw mailboxError;
    }

    // Check if the user has threat intelligence access using the helper function
    const { data: hasAccess, error: accessError } = await supabase
      .rpc('has_threat_intelligence_access', { _user_id: mailbox.user_id });

    if (accessError) {
      console.error('Error checking threat intelligence access:', accessError);
      throw accessError;
    }

    if (!hasAccess) {
      console.log(`User ${mailbox.user_id} does not have threat intelligence access. Skipping threat check.`);
      return new Response(JSON.stringify({
        threats_detected: 0,
        max_threat_score: 0,
        threat_details: [],
        should_quarantine: false,
        message: "User does not have threat intelligence access"
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`User has threat intelligence access. Proceeding with threat check.`);

    // Get active threat intelligence feeds for this tenant
    const { data: feeds, error: feedsError } = await supabase
      .from('threat_intelligence_feeds')
      .select('*')
      .or(`tenant_id.eq.${tenant_id},is_preconfigured.eq.true`)
      .eq('is_active', true);

    if (feedsError) {
      console.error('Error fetching threat feeds:', feedsError);
      throw feedsError;
    }

    console.log(`Found ${feeds?.length || 0} active threat feeds`);

    const threatResults: ThreatCheckResult = {
      threats_detected: 0,
      max_threat_score: 0,
      threat_details: [],
      should_quarantine: false
    };

    // Extract indicators from email
    const indicators = extractIndicators(email_content);
    console.log(`Extracted ${indicators.domains.length} domains, ${indicators.urls.length} URLs, ${indicators.ips.length} IPs`);

    // Check each feed
    for (const feed of feeds || []) {
      try {
        console.log(`Checking feed: ${feed.name} (${feed.feed_type})`);
        
        const feedResults = await checkFeedForThreats(feed, indicators, supabase);
        
        if (feedResults.length > 0) {
          console.log(`Found ${feedResults.length} threats in feed: ${feed.name}`);
          
          for (const result of feedResults) {
            threatResults.threat_details.push({
              feed_name: feed.name,
              threat_type: feed.feed_type,
              threat_indicator: result.indicator,
              threat_score: result.score,
              details: result.details
            });

            threatResults.threats_detected++;
            if (result.score > threatResults.max_threat_score) {
              threatResults.max_threat_score = result.score;
            }

            // Store threat result in database
            await supabase
              .from('threat_intelligence_results')
              .insert({
                email_id,
                feed_id: feed.id,
                threat_type: feed.feed_type,
                threat_indicator: result.indicator,
                threat_score: result.score,
                details: result.details,
                tenant_id
              });
          }
        }

        // Update feed statistics
        const successRate = feed.success_rate || 100;
        await supabase
          .from('threat_intelligence_feeds')
          .update({
            success_rate: Math.max(successRate - 0.1, 95), // Slight decay unless actively maintained
            last_updated_at: new Date().toISOString()
          })
          .eq('id', feed.id);

      } catch (error) {
        console.error(`Error checking feed ${feed.name}:`, error);
        
        // Update feed with error
        await supabase
          .from('threat_intelligence_feeds')
          .update({
            success_rate: Math.max((feed.success_rate || 100) - 5, 0),
            last_updated_at: new Date().toISOString()
          })
          .eq('id', feed.id);
      }
    }

    // Determine if email should be quarantined based on configurable threat score
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'email_config')
      .maybeSingle();
    
    const threatThreshold = settingsData?.value?.threat_quarantine_threshold || 70;
    threatResults.should_quarantine = threatResults.max_threat_score >= threatThreshold;

    console.log(`Threat check completed. Threats: ${threatResults.threats_detected}, Max Score: ${threatResults.max_threat_score}, Threshold: ${threatThreshold}, Quarantine: ${threatResults.should_quarantine}`);

    return new Response(JSON.stringify({
      success: true,
      result: threatResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in threat intelligence checker:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractIndicators(email_content: any) {
  const text = `${email_content.subject} ${email_content.body_content || email_content.body_preview || ''}`;
  
  // Extract domains
  const domainRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+)/g;
  const domains = Array.from(new Set(
    Array.from(text.matchAll(domainRegex), m => m[1].toLowerCase())
      .filter(domain => domain && !isCommonDomain(domain))
  ));

  // Extract URLs
  const urlRegex = /https?:\/\/[^\s<>"]+/g;
  const urls = Array.from(new Set(
    Array.from(text.matchAll(urlRegex), m => m[0])
      .filter(url => url && url.length > 10)
  ));

  // Extract IP addresses
  const ipRegex = /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
  const ips = Array.from(new Set(
    Array.from(text.matchAll(ipRegex), m => m[0])
      .filter(ip => !isPrivateIP(ip))
  ));

  // Also check sender domain
  const senderDomain = email_content.sender_email.split('@')[1]?.toLowerCase();
  if (senderDomain && !isCommonDomain(senderDomain) && !domains.includes(senderDomain)) {
    domains.push(senderDomain);
  }

  return { domains, urls, ips };
}

function isCommonDomain(domain: string): boolean {
  const commonDomains = [
    'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'aol.com',
    'icloud.com', 'protonmail.com', 'microsoft.com', 'google.com',
    'facebook.com', 'twitter.com', 'linkedin.com', 'amazon.com',
    'apple.com', 'netflix.com', 'youtube.com', 'instagram.com'
  ];
  return commonDomains.includes(domain);
}

function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  return (
    (parts[0] === 10) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 127)
  );
}

async function checkFeedForThreats(feed: any, indicators: any, supabase: any) {
  const results: Array<{indicator: string, score: number, details: any}> = [];

  try {
    console.log(`Checking feed: ${feed.name} with ${indicators.domains.length + indicators.urls.length + indicators.ips.length} indicators`);
    
    if (feed.feed_type === 'domain_blocklist') {
      for (const domain of indicators.domains) {
        const result = await checkDomainThreat(domain, feed);
        if (result) results.push(result);
      }
    }

    if (feed.feed_type === 'url_blocklist' || feed.feed_type === 'phishing_check') {
      for (const url of indicators.urls) {
        const result = await checkUrlThreat(url, feed);
        if (result) results.push(result);
      }
    }

    if (feed.feed_type === 'ip_blocklist') {
      for (const ip of indicators.ips) {
        const result = await checkIpThreat(ip, feed);
        if (result) results.push(result);
      }
    }

    // Add domain reputation checking for sender domains
    if (feed.feed_type === 'domain_reputation') {
      for (const domain of indicators.domains) {
        const result = await checkDomainReputation(domain, feed);
        if (result) results.push(result);
      }
    }

  } catch (error) {
    console.error(`Error checking feed ${feed.name}:`, error);
  }

  return results;
}

// Cache for threat feed data to avoid excessive API calls
const threatFeedCache = new Map<string, { data: Set<string>, timestamp: number }>();
const CACHE_TTL = 3600000; // 1 hour

async function fetchFeedData(feed: any): Promise<Set<string>> {
  const cacheKey = `${feed.id}_${feed.name}`;
  const cached = threatFeedCache.get(cacheKey);
  
  // Return cached data if still valid
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  const threatSet = new Set<string>();

  try {
    if (feed.feed_url) {
      console.log(`Fetching fresh data from feed: ${feed.name}`);
      const response = await fetch(feed.feed_url, {
        headers: feed.api_key ? { 'Authorization': `Bearer ${feed.api_key}` } : {}
      });

      if (response.ok) {
        const text = await response.text();
        
        // Parse different feed formats
        if (feed.name.toLowerCase().includes('malware domain list') || 
            feed.name.toLowerCase().includes('phishtank') ||
            feed.feed_type === 'domain_blocklist') {
          parseDomainFeed(text, threatSet);
        } else if (feed.feed_type === 'url_blocklist' || feed.feed_type === 'phishing_check') {
          parseUrlFeed(text, threatSet);
        } else if (feed.feed_type === 'ip_blocklist') {
          parseIpFeed(text, threatSet);
        }

        // Cache the results
        threatFeedCache.set(cacheKey, { data: threatSet, timestamp: Date.now() });
        console.log(`Cached ${threatSet.size} indicators from ${feed.name}`);
      }
    }
  } catch (error) {
    console.error(`Error fetching feed data for ${feed.name}:`, error);
    // Return cached data even if expired, better than nothing
    if (cached) return cached.data;
  }

  return threatSet;
}

function parseDomainFeed(text: string, threatSet: Set<string>) {
  const lines = text.split('\n');
  for (const line of lines) {
    const cleaned = line.trim().toLowerCase();
    if (cleaned && !cleaned.startsWith('#') && !cleaned.startsWith('//')) {
      // Extract domain from various formats
      const domainMatch = cleaned.match(/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)/);
      if (domainMatch) {
        threatSet.add(domainMatch[1]);
      }
    }
  }
}

function parseUrlFeed(text: string, threatSet: Set<string>) {
  const lines = text.split('\n');
  for (const line of lines) {
    const cleaned = line.trim();
    if (cleaned && !cleaned.startsWith('#') && (cleaned.startsWith('http://') || cleaned.startsWith('https://'))) {
      threatSet.add(cleaned.toLowerCase());
    }
  }
}

function parseIpFeed(text: string, threatSet: Set<string>) {
  const lines = text.split('\n');
  const ipRegex = /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/;
  
  for (const line of lines) {
    const cleaned = line.trim();
    if (cleaned && !cleaned.startsWith('#')) {
      const ipMatch = cleaned.match(ipRegex);
      if (ipMatch && !isPrivateIP(ipMatch[0])) {
        threatSet.add(ipMatch[0]);
      }
    }
  }
}

async function checkDomainThreat(domain: string, feed: any) {
  const feedData = await fetchFeedData(feed);
  
  // Check exact match
  if (feedData.has(domain)) {
    return {
      indicator: domain,
      score: 90,
      details: { 
        feed_type: feed.feed_type, 
        domain,
        match_type: 'exact',
        feed_source: feed.name
      }
    };
  }

  // Check subdomain matches for known bad parent domains
  for (const badDomain of feedData) {
    if (domain.endsWith('.' + badDomain)) {
      return {
        indicator: domain,
        score: 75,
        details: { 
          feed_type: feed.feed_type, 
          domain,
          parent_domain: badDomain,
          match_type: 'subdomain',
          feed_source: feed.name
        }
      };
    }
  }

  return null;
}

async function checkUrlThreat(url: string, feed: any) {
  const feedData = await fetchFeedData(feed);
  const urlLower = url.toLowerCase();
  
  // Check exact URL match
  if (feedData.has(urlLower)) {
    return {
      indicator: url,
      score: 95,
      details: { 
        feed_type: feed.feed_type, 
        url,
        match_type: 'exact',
        feed_source: feed.name
      }
    };
  }

  // Check if URL contains known malicious patterns
  for (const badUrl of feedData) {
    if (urlLower.includes(badUrl) || badUrl.includes(urlLower)) {
      return {
        indicator: url,
        score: 85,
        details: { 
          feed_type: feed.feed_type, 
          url,
          matched_pattern: badUrl,
          match_type: 'pattern',
          feed_source: feed.name
        }
      };
    }
  }

  return null;
}

async function checkIpThreat(ip: string, feed: any) {
  const feedData = await fetchFeedData(feed);
  
  if (feedData.has(ip)) {
    return {
      indicator: ip,
      score: 85,
      details: { 
        feed_type: feed.feed_type, 
        ip,
        match_type: 'exact',
        feed_source: feed.name
      }
    };
  }

  return null;
}

async function checkDomainReputation(domain: string, feed: any) {
  // Use VirusTotal-like API checking for domain reputation
  if (feed.api_endpoint && feed.api_key) {
    try {
      const response = await fetch(`${feed.api_endpoint}/domains/${domain}`, {
        headers: { 
          'x-apikey': feed.api_key,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const malicious = data.data?.attributes?.last_analysis_stats?.malicious || 0;
        const suspicious = data.data?.attributes?.last_analysis_stats?.suspicious || 0;
        
        if (malicious > 2 || suspicious > 5) {
          return {
            indicator: domain,
            score: Math.min(50 + (malicious * 10) + (suspicious * 5), 100),
            details: { 
              feed_type: feed.feed_type, 
              domain,
              malicious_votes: malicious,
              suspicious_votes: suspicious,
              feed_source: feed.name
            }
          };
        }
      }
    } catch (error) {
      console.error(`Error checking domain reputation for ${domain}:`, error);
    }
  }

  return null;
}