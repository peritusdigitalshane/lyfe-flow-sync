import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; tenant_id: string; email: string; full_name: string | null; created_at: string; updated_at: string };
        Insert: { id: string; tenant_id?: string; email: string; full_name?: string | null };
        Update: { id?: string; tenant_id?: string; email?: string; full_name?: string | null };
      };
      mailboxes: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          email_address: string;
          display_name: string;
          status: 'pending' | 'connected' | 'error' | 'paused';
          n8n_credential_id: string | null;
          n8n_workflow_id: string | null;
          microsoft_graph_token: string | null;
          last_sync_at: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          email_address: string;
          display_name: string;
          status?: 'pending' | 'connected' | 'error' | 'paused';
          n8n_credential_id?: string | null;
          n8n_workflow_id?: string | null;
          microsoft_graph_token?: string | null;
          last_sync_at?: string | null;
          error_message?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          email_address?: string;
          display_name?: string;
          status?: 'pending' | 'connected' | 'error' | 'paused';
          n8n_credential_id?: string | null;
          n8n_workflow_id?: string | null;
          microsoft_graph_token?: string | null;
          last_sync_at?: string | null;
          error_message?: string | null;
        };
      };
    };
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('OAuth callback function called');

    // Initialize Supabase client
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header missing' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    // Get user's tenant_id
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.tenant_id;
    console.log('Tenant ID:', tenantId);

    const { code, redirectUri } = await req.json();
    console.log('Received OAuth callback:', { code: code ? 'present' : 'missing', redirectUri });

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Authorization code missing' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Microsoft OAuth settings from database
    const { data: oauthConfig } = await supabaseClient
      .from('app_settings')
      .select('value')
      .eq('key', 'microsoft_oauth')
      .single();

    if (!oauthConfig?.value) {
      console.error('Microsoft OAuth settings not found');
      return new Response(
        JSON.stringify({ error: 'Microsoft OAuth not configured. Please configure the settings first.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = oauthConfig.value as any;
    const clientId = config.client_id;
    const clientSecret = config.client_secret;
    const tenantIdEnv = config.tenant_id || 'common';

    if (!clientId || !clientSecret) {
      console.error('Microsoft credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Microsoft OAuth not configured. Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Exchanging code for token...');

    // Exchange authorization code for access token
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantIdEnv}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'openid profile email Mail.ReadWrite offline_access',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange authorization code for token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful');

    // Get user info from Microsoft Graph
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info from Microsoft Graph');
      return new Response(
        JSON.stringify({ error: 'Failed to get user information from Microsoft' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userInfo = await userInfoResponse.json();
    console.log('Got user info:', { email: userInfo.mail || userInfo.userPrincipalName });

    // Find the pending mailbox for this user and email
    const userEmail = userInfo.mail || userInfo.userPrincipalName;
    const { data: mailbox, error: mailboxError } = await supabaseClient
      .from('mailboxes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('email_address', userEmail)
      .eq('status', 'pending')
      .single();

    if (mailboxError || !mailbox) {
      console.error('No pending mailbox found for email:', userEmail);
      return new Response(
        JSON.stringify({ error: 'No pending mailbox found for this email address' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found pending mailbox:', mailbox.id);

    // Update mailbox with tokens and set status to connected
    const { error: updateError } = await supabaseClient
      .from('mailboxes')
      .update({
        status: 'connected',
        microsoft_graph_token: JSON.stringify({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: Date.now() + (tokenData.expires_in * 1000),
        }),
        last_sync_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', mailbox.id);

    if (updateError) {
      console.error('Failed to update mailbox:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update mailbox status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Mailbox updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        mailbox: {
          id: mailbox.id,
          email_address: userEmail,
          status: 'connected'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});