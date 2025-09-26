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

    // Parse request body
    const body = await req.json();
    const { emailAddress, displayName, preset, mailboxId } = body;

    if (!emailAddress || !displayName) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing required fields'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Microsoft OAuth settings
    const { data: oauthConfig } = await supabaseClient
      .from('app_settings')
      .select('value')
      .eq('key', 'microsoft_oauth')
      .single();

    if (!oauthConfig?.value) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'OAuth configuration not found'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = oauthConfig.value as any;
    if (!config.client_id || !config.client_secret) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Microsoft OAuth not configured'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate OAuth URL
    const refererHeader = req.headers.get('referer') || req.headers.get('origin');
    let origin = 'https://preview--lyfe-flow-sync.lovable.app';
    
    if (refererHeader) {
      try {
        const refererUrl = new URL(refererHeader);
        origin = refererUrl.origin;
      } catch (e) {
        // Use default origin
      }
    }
    
    const redirectUri = `${origin}/auth/callback`;
    const authUrl = `https://login.microsoftonline.com/${config.tenant_id || 'common'}/oauth2/v2.0/authorize?` +
      `client_id=${encodeURIComponent(config.client_id)}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=openid%20profile%20email%20User.Read%20Mail.ReadWrite%20Mail.Send%20MailboxSettings.ReadWrite%20offline_access&` +
      `prompt=consent&` +
      `state=${Date.now()}`;

    let mailbox;

    if (preset === 'existing' && mailboxId) {
      // Re-authentication: update existing mailbox
      const { data, error } = await supabaseClient
        .from('mailboxes')
        .update({
          status: 'pending',
          error_message: null,
        })
        .eq('id', mailboxId)
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Mailbox not found'
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      mailbox = data;
      await logAudit(supabaseClient, tenantId, 'mailbox_reauth_initiated', {
        mailbox_id: mailbox.id,
        email_address: emailAddress,
      }, mailbox.id, user.id, req);
    } else {
      // Create new mailbox
      const { data, error } = await supabaseClient
        .from('mailboxes')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          email_address: emailAddress,
          display_name: displayName,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Failed to create mailbox',
            details: error.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      mailbox = data;
      await logAudit(supabaseClient, tenantId, 'mailbox_created', {
        mailbox_id: mailbox.id,
        email_address: emailAddress,
      }, mailbox.id, user.id, req);
    }

    return new Response(
      JSON.stringify({
        success: true,
        mailbox,
        authUrl: authUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});