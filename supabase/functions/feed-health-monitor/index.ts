import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeedHealthStatus {
  feed_id: string;
  is_healthy: boolean;
  entries_count: number;
  response_time_ms: number;
  last_error?: string;
  status_code?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting feed health monitoring...');

    // Get all active feeds
    const { data: feeds, error: feedsError } = await supabase
      .from('threat_intelligence_feeds')
      .select('*')
      .eq('is_active', true);

    if (feedsError) {
      throw feedsError;
    }

    const healthResults: FeedHealthStatus[] = [];

    // Test each feed
    for (const feed of feeds || []) {
      console.log(`Testing feed: ${feed.name}`);
      const startTime = Date.now();
      
      try {
        let entriesCount = 0;
        let isHealthy = false;
        let statusCode = 0;
        let lastError = '';

        if (feed.feed_url) {
          const response = await fetch(feed.feed_url, {
            method: 'HEAD', // First try HEAD request for performance
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });

          statusCode = response.status;

          if (response.ok) {
            // If HEAD worked, get actual data to count entries
            const dataResponse = await fetch(feed.feed_url, {
              signal: AbortSignal.timeout(15000) // 15 second timeout for data
            });

            if (dataResponse.ok) {
              const text = await dataResponse.text();
              entriesCount = countEntriesInFeed(text, feed.feed_type);
              isHealthy = entriesCount > 0;
            } else {
              lastError = `HTTP ${dataResponse.status}: ${dataResponse.statusText}`;
            }
          } else {
            lastError = `HTTP ${response.status}: ${response.statusText}`;
          }
        } else if (feed.api_endpoint) {
          // API-based feed (like VirusTotal)
          isHealthy = !!feed.api_key; // Healthy if API key is configured
          entriesCount = isHealthy ? -1 : 0; // -1 indicates API endpoint (not countable)
          
          if (!feed.api_key) {
            lastError = 'API key required but not configured';
          }
        }

        const responseTime = Date.now() - startTime;

        healthResults.push({
          feed_id: feed.id,
          is_healthy: isHealthy,
          entries_count: entriesCount,
          response_time_ms: responseTime,
          last_error: lastError || undefined,
          status_code: statusCode || undefined
        });

        // Update feed statistics in database
        await supabase
          .from('threat_intelligence_feeds')
          .update({
            total_entries: entriesCount,
            success_rate: isHealthy ? Math.min((feed.success_rate || 95) + 1, 100) : Math.max((feed.success_rate || 95) - 10, 0),
            last_updated_at: new Date().toISOString()
          })
          .eq('id', feed.id);

        console.log(`Feed ${feed.name}: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'} (${entriesCount} entries, ${responseTime}ms)`);

      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error.message || 'Unknown error';
        
        healthResults.push({
          feed_id: feed.id,
          is_healthy: false,
          entries_count: 0,
          response_time_ms: responseTime,
          last_error: errorMessage
        });

        // Update feed with error
        await supabase
          .from('threat_intelligence_feeds')
          .update({
            success_rate: Math.max((feed.success_rate || 95) - 10, 0),
            last_updated_at: new Date().toISOString()
          })
          .eq('id', feed.id);

        console.error(`Feed ${feed.name} failed:`, errorMessage);
      }
    }

    // Log overall health status
    const healthyCount = healthResults.filter(r => r.is_healthy).length;
    const totalCount = healthResults.length;
    
    console.log(`Feed health check completed: ${healthyCount}/${totalCount} feeds healthy`);

    return new Response(JSON.stringify({
      success: true,
      summary: {
        total_feeds: totalCount,
        healthy_feeds: healthyCount,
        unhealthy_feeds: totalCount - healthyCount
      },
      results: healthResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in feed health monitor:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function countEntriesInFeed(text: string, feedType: string): number {
  const lines = text.split('\n');
  let count = 0;

  for (const line of lines) {
    const cleaned = line.trim().toLowerCase();
    
    // Skip comments and empty lines
    if (!cleaned || cleaned.startsWith('#') || cleaned.startsWith('//') || cleaned.startsWith(';')) {
      continue;
    }

    // Count based on feed type
    switch (feedType) {
      case 'domain_blocklist':
        // Look for valid domain patterns
        if (cleaned.match(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/)) {
          count++;
        }
        break;
        
      case 'url_blocklist':
      case 'phishing_check':
        // Look for URLs
        if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
          count++;
        }
        break;
        
      case 'ip_blocklist':
        // Look for IP addresses
        if (cleaned.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
          count++;
        }
        break;
        
      default:
        // Generic line counting for unknown types
        if (cleaned.length > 3) {
          count++;
        }
    }
  }

  return count;
}