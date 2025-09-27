import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OAuthCallbackRequest {
  code: string;
  state: string;
  redirectUri: string;
}

interface OAuthConfig {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  tenant_id?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting OAuth callback processing...');
    
    // Check if this is a direct browser redirect from Microsoft (GET request with query params)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');
      const state = url.searchParams.get('state');
      
      // Determine the app origin for redirecting back
      const refererHeader = req.headers.get('referer');
      let appOrigin = 'https://preview--lyfe-flow-sync.lovable.app';
      
      if (refererHeader) {
        try {
          const refererUrl = new URL(refererHeader);
          appOrigin = refererUrl.origin;
        } catch (e) {
          // Use default if parsing fails
        }
      }

      if (error) {
        console.error('OAuth error from Microsoft:', error, errorDescription);
        const errorUrl = `${appOrigin}/auth/callback?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`;
        return Response.redirect(errorUrl, 302);
      }

      if (!code || !state) {
        console.error('Missing code or state in OAuth callback');
        const errorUrl = `${appOrigin}/auth/callback?error=invalid_request&error_description=${encodeURIComponent('Missing authorization code or state')}`;
        return Response.redirect(errorUrl, 302);
      }

      // Process the OAuth callback
      console.log('Processing OAuth callback for state:', state);

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get OAuth configuration from database
      const { data: oauthConfigData, error: oauthError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'microsoft_oauth')
        .maybeSingle();

      if (oauthError || !oauthConfigData?.value) {
        console.error('Failed to fetch OAuth config:', oauthError);
        const errorUrl = `${appOrigin}/auth/callback?error=server_error&error_description=${encodeURIComponent('OAuth configuration not found')}`;
        return Response.redirect(errorUrl, 302);
      }

      const oauthConfig = oauthConfigData.value as OAuthConfig;
      const redirectUri = `https://ceasktzguzibehknbgsx.supabase.co/functions/v1/mailbox-oauth-callback`;

      // Exchange authorization code for access token
      console.log('Exchanging authorization code for tokens...');
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: oauthConfig.client_id,
          client_secret: oauthConfig.client_secret,
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access',
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          errorText,
        });
        const errorUrl = `${appOrigin}/auth/callback?error=token_exchange_failed&error_description=${encodeURIComponent('Failed to exchange authorization code')}`;
        return Response.redirect(errorUrl, 302);
      }

      const tokenData = await tokenResponse.json();
      console.log('Token exchange successful');

      // Add expiration timestamp to token data
      const tokenWithExpiry = {
        ...tokenData,
        expires_at: Date.now() + (tokenData.expires_in * 1000)
      };

      // Update mailbox with new token
      const { error: updateError } = await supabase
        .from('mailboxes')
        .update({
          status: 'connected',
          microsoft_graph_token: JSON.stringify(tokenWithExpiry),
          error_message: null,
          last_sync_at: new Date().toISOString()
        })
        .eq('id', state);

      if (updateError) {
        console.error('Failed to update mailbox:', updateError);
        const errorUrl = `${appOrigin}/auth/callback?error=database_error&error_description=${encodeURIComponent('Failed to save mailbox credentials')}`;
        return Response.redirect(errorUrl, 302);
      }

      console.log('Mailbox updated successfully for state:', state);
      
      // Redirect back to the application with success
      const successUrl = `${appOrigin}/auth/callback?success=true&mailbox_id=${state}`;
      return Response.redirect(successUrl, 302);
    }

    // Handle POST requests (for programmatic API calls)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const token = authHeader.substring(7);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the user with the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Failed to authenticate user:', authError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('User authenticated:', user.id);

    const { code, state, redirectUri }: OAuthCallbackRequest = await req.json();

    if (!code || !state || !redirectUri) {
      console.error('Missing required parameters:', { code: !!code, state: !!state, redirectUri: !!redirectUri });
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('Processing OAuth callback for state:', state);

    // Get OAuth configuration from database
    const { data: oauthConfigData, error: oauthError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'microsoft_oauth')
      .maybeSingle();

    if (oauthError || !oauthConfigData?.value) {
      console.error('Failed to fetch OAuth config:', oauthError);
      return new Response(JSON.stringify({ error: 'OAuth configuration not found' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const oauthConfig = oauthConfigData.value as OAuthConfig;
    console.log('Using OAuth config with client_id:', oauthConfig.client_id);

    // Exchange authorization code for access token
    console.log('Exchanging authorization code for tokens...');
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: oauthConfig.client_id,
        client_secret: oauthConfig.client_secret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        errorText,
        redirectUri
      });
      return new Response(JSON.stringify({ 
        error: 'Token exchange failed',
        details: errorText 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful');

    // Add expiration timestamp to token data
    const tokenWithExpiry = {
      ...tokenData,
      expires_at: Date.now() + (tokenData.expires_in * 1000)
    };

    // Update mailbox with new token
    const { error: updateError } = await supabase
      .from('mailboxes')
      .update({
        status: 'connected',
        microsoft_graph_token: JSON.stringify(tokenWithExpiry),
        error_message: null,
        last_sync_at: new Date().toISOString()
      })
      .eq('id', state);

    if (updateError) {
      console.error('Failed to update mailbox:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update mailbox' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('Mailbox updated successfully for state:', state);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);