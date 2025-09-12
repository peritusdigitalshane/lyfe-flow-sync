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

    // Determine if email should be quarantined based on threat score
    threatResults.should_quarantine = threatResults.max_threat_score >= 70;

    console.log(`Threat check completed. Threats: ${threatResults.threats_detected}, Max Score: ${threatResults.max_threat_score}, Quarantine: ${threatResults.should_quarantine}`);

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
    // For demonstration, we'll implement basic checks for a few feed types
    // In production, you'd want more sophisticated checking based on feed format
    
    if (feed.feed_type === 'domain_blocklist') {
      // Check domains against known malicious domains
      for (const domain of indicators.domains) {
        if (await isDomainMalicious(domain, feed)) {
          results.push({
            indicator: domain,
            score: 85,
            details: { feed_type: 'domain_blocklist', domain }
          });
        }
      }
    }

    if (feed.feed_type === 'url_blocklist') {
      // Check URLs against known malicious URLs
      for (const url of indicators.urls) {
        if (await isUrlMalicious(url, feed)) {
          results.push({
            indicator: url,
            score: 90,
            details: { feed_type: 'url_blocklist', url }
          });
        }
      }
    }

    if (feed.feed_type === 'ip_blocklist') {
      // Check IPs against known malicious IPs
      for (const ip of indicators.ips) {
        if (await isIpMalicious(ip, feed)) {
          results.push({
            indicator: ip,
            score: 80,
            details: { feed_type: 'ip_blocklist', ip }
          });
        }
      }
    }

    if (feed.feed_type === 'phishing_check') {
      // Enhanced phishing detection
      for (const url of indicators.urls) {
        if (await isPhishingUrl(url, feed)) {
          results.push({
            indicator: url,
            score: 95,
            details: { feed_type: 'phishing_check', url, reason: 'Known phishing URL' }
          });
        }
      }
    }

  } catch (error) {
    console.error(`Error checking feed ${feed.name}:`, error);
  }

  return results;
}

async function isDomainMalicious(domain: string, feed: any): Promise<boolean> {
  // This is a simplified check - in production you'd fetch and cache the actual feed data
  // For demonstration, we'll check against some known patterns
  const suspiciousDomains = [
    'phishing-example.com',
    'malware-test.net',
    'suspicious-domain.org'
  ];
  
  return suspiciousDomains.some(suspicious => 
    domain.includes(suspicious) || suspicious.includes(domain)
  );
}

async function isUrlMalicious(url: string, feed: any): Promise<boolean> {
  // Simplified URL check
  const suspiciousPatterns = [
    '/phishing/',
    '/malware/',
    '/suspicious/',
    'bit.ly/suspicious',
    'tinyurl.com/malware'
  ];
  
  return suspiciousPatterns.some(pattern => url.includes(pattern));
}

async function isIpMalicious(ip: string, feed: any): Promise<boolean> {
  // Simplified IP check - you'd normally check against actual blocklists
  const knownMaliciousIPs = [
    '192.0.2.1', // RFC 5737 test IP
    '198.51.100.1',
    '203.0.113.1'
  ];
  
  return knownMaliciousIPs.includes(ip);
}

async function isPhishingUrl(url: string, feed: any): Promise<boolean> {
  // Enhanced phishing detection logic
  const phishingIndicators = [
    'secure-update',
    'account-verify',
    'suspended-account',
    'urgent-action',
    'click-here-now'
  ];
  
  const urlLower = url.toLowerCase();
  return phishingIndicators.some(indicator => urlLower.includes(indicator));
}