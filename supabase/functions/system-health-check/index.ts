import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Running system health check...');

    const healthCheck = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {},
      errors: []
    };

    // Check 1: Database connectivity
    try {
      const { data, error } = await supabase.from('emails').select('count').limit(1);
      if (error) throw error;
      healthCheck.checks.database = { status: 'ok', message: 'Database connected' };
    } catch (error) {
      healthCheck.checks.database = { status: 'error', message: error.message };
      healthCheck.errors.push(`Database: ${error.message}`);
      healthCheck.status = 'unhealthy';
    }

    // Check 2: Email queue status
    try {
      const { data: pendingCount, error } = await supabase
        .from('emails')
        .select('id', { count: 'exact' })
        .eq('processing_status', 'pending');
      
      if (error) throw error;
      
      const count = pendingCount?.length || 0;
      healthCheck.checks.email_queue = { 
        status: count > 50 ? 'warning' : 'ok', 
        message: `${count} pending emails`,
        pending_count: count
      };
      
      if (count > 100) {
        healthCheck.status = 'warning';
        healthCheck.errors.push(`High pending email count: ${count}`);
      }
    } catch (error) {
      healthCheck.checks.email_queue = { status: 'error', message: error.message };
      healthCheck.errors.push(`Email queue: ${error.message}`);
      healthCheck.status = 'unhealthy';
    }

    // Check 3: Recent processing activity
    try {
      const { data: recentActivity, error } = await supabase
        .from('audit_logs')
        .select('id, created_at')
        .eq('action', 'email_processed')
        .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 minutes
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      healthCheck.checks.recent_activity = {
        status: recentActivity && recentActivity.length > 0 ? 'ok' : 'warning',
        message: recentActivity && recentActivity.length > 0 
          ? 'Recent email processing detected' 
          : 'No recent email processing activity',
        last_activity: recentActivity?.[0]?.created_at || null
      };
    } catch (error) {
      healthCheck.checks.recent_activity = { status: 'error', message: error.message };
      healthCheck.errors.push(`Activity check: ${error.message}`);
    }

    // Check 4: Edge functions status
    try {
      const testResponse = await fetch(`${supabaseUrl}/functions/v1/email-workflow-processor`, {
        method: 'OPTIONS',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
        }
      });
      
      healthCheck.checks.edge_functions = {
        status: testResponse.ok ? 'ok' : 'error',
        message: testResponse.ok ? 'Edge functions accessible' : 'Edge functions unreachable'
      };
      
      if (!testResponse.ok) {
        healthCheck.status = 'unhealthy';
        healthCheck.errors.push('Edge functions not accessible');
      }
    } catch (error) {
      healthCheck.checks.edge_functions = { status: 'error', message: error.message };
      healthCheck.errors.push(`Edge functions: ${error.message}`);
      healthCheck.status = 'unhealthy';
    }

    return new Response(JSON.stringify(healthCheck), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Health check error:', error);
    return new Response(JSON.stringify({
      timestamp: new Date().toISOString(),
      status: 'unhealthy',
      error: 'Health check failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});