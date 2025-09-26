import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface Database {
  public: {
    Tables: {
      mailboxes: {
        Update: {
          status?: 'pending' | 'connected' | 'error' | 'paused';
          microsoft_graph_token?: string;
          error_message?: string | null;
          last_sync_at?: string;
        };
      };
      app_settings: {
        Row: {
          key: string;
          value: any;
        };
      };
    };
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('OAuth callback received:', req.method, req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // This should be the mailboxId
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    console.log('OAuth callback params:', { code: !!code, state, error, errorDescription });

    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return new Response(
        `<html><body><h1>Authentication Error</h1><p>${error}: ${errorDescription}</p><script>window.close();</script></body></html>`,
        { 
          status: 400, 
          headers: { 'Content-Type': 'text/html', ...corsHeaders } 
        }
      );
    }

    if (!code || !state) {
      console.error('Missing code or state parameter');
      return new Response(
        '<html><body><h1>Authentication Error</h1><p>Missing authorization code or state parameter</p><script>window.close();</script></body></html>',
        { 
          status: 400, 
          headers: { 'Content-Type': 'text/html', ...corsHeaders } 
        }
      );
    }

    const mailboxId = state;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Get OAuth configuration
    const { data: oauthConfigData, error: oauthError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'microsoft_oauth')
      .single();

    if (oauthError || !oauthConfigData?.value) {
      console.error('Failed to get OAuth config:', oauthError);
      return new Response(
        '<html><body><h1>Configuration Error</h1><p>OAuth configuration not found</p><script>window.close();</script></body></html>',
        { 
          status: 500, 
          headers: { 'Content-Type': 'text/html', ...corsHeaders } 
        }
      );
    }

    const oauthConfig = oauthConfigData.value;

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: oauthConfig.client_id,
        client_secret: oauthConfig.client_secret,
        code: code,
        redirect_uri: oauthConfig.redirect_uri,
        grant_type: 'authorization_code',
        scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(
        '<html><body><h1>Token Exchange Failed</h1><p>Failed to exchange authorization code for access token</p><script>window.close();</script></body></html>',
        { 
          status: 500, 
          headers: { 'Content-Type': 'text/html', ...corsHeaders } 
        }
      );
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
      .eq('id', mailboxId);

    if (updateError) {
      console.error('Failed to update mailbox:', updateError);
      return new Response(
        '<html><body><h1>Database Error</h1><p>Failed to update mailbox with new token</p><script>window.close();</script></body></html>',
        { 
          status: 500, 
          headers: { 'Content-Type': 'text/html', ...corsHeaders } 
        }
      );
    }

    console.log('Mailbox updated successfully:', mailboxId);

    // Get the redirect URL from localStorage or default to dashboard
    const redirectScript = `
      <script>
        try {
          const redirectPath = localStorage.getItem('post_auth_redirect') || '/dashboard';
          localStorage.removeItem('post_auth_redirect');
          console.log('Redirecting to:', redirectPath);
          window.location.href = redirectPath;
        } catch (error) {
          console.error('Redirect error:', error);
          window.location.href = '/dashboard';
        }
      </script>
    `;

    // Return success response with redirect
    return new Response(
      `<html>
        <body>
          <h1>Authentication Successful!</h1>
          <p>Your mailbox has been successfully connected. Redirecting...</p>
          ${redirectScript}
        </body>
      </html>`,
      { 
        status: 200, 
        headers: { 'Content-Type': 'text/html', ...corsHeaders } 
      }
    );

  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(
      '<html><body><h1>Internal Error</h1><p>An unexpected error occurred during authentication</p><script>window.close();</script></body></html>',
      { 
        status: 500, 
        headers: { 'Content-Type': 'text/html', ...corsHeaders } 
      }
    );
  }
});