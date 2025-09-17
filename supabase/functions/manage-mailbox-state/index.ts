import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function logAudit(
  supabase: any,
  tenantId: string,
  action: string,
  details: any,
  mailboxId?: string,
  userId?: string,
  req?: Request
) {
  try {
    const forwardedFor = req?.headers.get('x-forwarded-for');
    const realIp = req?.headers.get('x-real-ip');
    
    let ip = 'unknown';
    if (forwardedFor) {
      ip = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      ip = realIp.trim();
    }
    
    const userAgent = req?.headers.get('user-agent') || 'unknown';

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      mailbox_id: mailboxId,
      user_id: userId,
      action,
      details,
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Server configuration error'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing authorization header'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid token'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant_id
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Profile not found'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.tenant_id;

    // Parse URL to get mailbox ID
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const mailboxId = pathParts[pathParts.length - 2]; // Expecting /manage-mailbox-state/{mailboxId}/state

    if (!mailboxId) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Mailbox ID required'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { action } = body; // 'pause' or 'resume'

    if (!action || !['pause', 'resume'].includes(action)) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid action. Must be "pause" or "resume"'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get mailbox to verify ownership
    const { data: mailbox, error: mailboxError } = await supabaseClient
      .from('mailboxes')
      .select('*')
      .eq('id', mailboxId)
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .single();

    if (mailboxError || !mailbox) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Mailbox not found'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newStatus = action === 'pause' ? 'paused' : 'connected';
    
    // Update mailbox status
    const { error: updateError } = await supabaseClient
      .from('mailboxes')
      .update({ status: newStatus })
      .eq('id', mailboxId);

    if (updateError) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to update mailbox status',
          details: updateError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log audit trail
    await logAudit(
      supabaseClient, 
      tenantId, 
      action === 'pause' ? 'mailbox_paused' : 'mailbox_resumed',
      { mailbox_id: mailboxId },
      mailboxId, 
      user.id, 
      req
    );

    return new Response(
      JSON.stringify({ 
        success: true,
        status: newStatus
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});