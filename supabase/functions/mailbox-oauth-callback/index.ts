import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import type { Database, MicrosoftErrorDetails } from "../_shared/types.ts";
import { corsHeaders, getErrorMessage, createErrorResponse } from "../_shared/utils.ts";

// Database and error types now imported from shared types

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
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('Authorization header missing');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Authorization header missing',
          details: 'Please ensure you are logged in'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Authentication failed',
          details: userError?.message || 'Invalid or expired session'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      console.error('User profile not found');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'User profile not found',
          details: 'Please ensure your account is properly set up'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.tenant_id;
    console.log('Tenant ID:', tenantId);

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid request body',
          details: 'Request body must be valid JSON'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { code, redirectUri } = requestBody;
    console.log('Received OAuth callback:', { code: code ? 'present' : 'missing', redirectUri });

    if (!code) {
      console.error('Authorization code missing');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Authorization code missing',
          details: 'No authorization code provided in the request'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ 
          success: false,
          error: 'Microsoft OAuth not configured',
          details: 'Please configure the Microsoft OAuth settings first'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = oauthConfig.value as any;
    const clientId = config.client_id;
    const clientSecret = config.client_secret;
    const tenantIdEnv = config.tenant_id || 'common';
    
    console.log('OAuth config loaded:', { 
      clientId: clientId ? `${clientId.substring(0, 8)}...` : 'missing',
      clientSecret: clientSecret ? `${clientSecret.substring(0, 8)}...` : 'missing',
      tenantId: tenantIdEnv 
    });

    if (!clientId || !clientSecret) {
      console.error('Microsoft credentials not configured');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Microsoft OAuth credentials missing',
          details: 'Client ID or Client Secret not configured'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        scope: 'openid profile email Mail.ReadWrite MailboxSettings.ReadWrite offline_access',
      }),
    });

    console.log('Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      
      // Parse error for better debugging
      let errorDetails = {};
      try {
        errorDetails = JSON.parse(errorText);
        console.error('Parsed Microsoft error:', errorDetails);
      } catch (parseError) {
        console.error('Could not parse error response:', parseError);
        errorDetails = { error: "unparseable_error", error_description: errorText.substring(0, 500) };
      }
      
      // Return 200 status with error details so client can access them
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to exchange authorization code for token',
          details: errorDetails.error_description || errorDetails.error || 'Unknown Microsoft error',
          microsoft_error: errorDetails,
          status_code: tokenResponse.status
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful, token details:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      tokenType: tokenData.token_type,
      expiresIn: tokenData.expires_in,
      scope: tokenData.scope || 'no scope field',
      tokenLength: tokenData.access_token ? tokenData.access_token.length : 0
    });

    // Decode the access token to see what permissions we actually have
    try {
      const tokenParts = tokenData.access_token.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(atob(tokenParts[1]));
        console.log('Access token payload:', {
          aud: payload.aud,
          iss: payload.iss,
          scp: payload.scp || 'no scp field',
          roles: payload.roles || 'no roles field',
          appId: payload.appid || payload.azp,
          tid: payload.tid,
          oid: payload.oid
        });
      }
    } catch (e) {
      console.log('Could not decode access token:', getErrorMessage(e));
    }

    // Get user info from Microsoft Graph
    console.log('Fetching user information from Microsoft Graph...');
    const graphUrl = 'https://graph.microsoft.com/v1.0/me';
    
    console.log('Making Graph API request:', {
      url: graphUrl,
      hasAccessToken: !!tokenData.access_token,
      tokenType: tokenData.token_type || 'Bearer',
      accessTokenLength: tokenData.access_token ? tokenData.access_token.length : 0
    });

    const userInfoResponse = await fetch(graphUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Graph API response status:', userInfoResponse.status);
    console.log('Graph API response headers:', Object.fromEntries(userInfoResponse.headers.entries()));

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      console.error('Microsoft Graph API call failed:', {
        status: userInfoResponse.status,
        statusText: userInfoResponse.statusText,
        error: errorText,
        headers: Object.fromEntries(userInfoResponse.headers.entries())
      });

      // Try to parse the error response
      let microsoftError = {};
      try {
        microsoftError = JSON.parse(errorText);
        console.error('Parsed Microsoft Graph error:', microsoftError);
      } catch (parseError) {
        console.error('Could not parse Graph API error response:', parseError);
        microsoftError = { error: "unparseable_error", error_description: errorText.substring(0, 500) };
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to get user information from Microsoft',
          details: `Graph API call failed: ${userInfoResponse.status} - ${errorText}`,
          microsoftError: microsoftError,
          graphApiStatus: userInfoResponse.status,
          accessTokenPresent: !!tokenData.access_token
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userInfo = await userInfoResponse.json();
    console.log('User info received:', {
      hasId: !!userInfo.id,
      hasEmail: !!userInfo.mail,
      hasUserPrincipalName: !!userInfo.userPrincipalName,
      hasDisplayName: !!userInfo.displayName,
      userInfo: userInfo
    });

    // Find the pending mailbox for this user and email (case-insensitive)
    const userEmail = userInfo.mail || userInfo.userPrincipalName;
    console.log('Looking for mailbox with email:', userEmail);
    
    const { data: mailbox, error: mailboxError } = await supabaseClient
      .from('mailboxes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .ilike('email_address', userEmail) // Case-insensitive match
      .eq('status', 'pending')
      .maybeSingle();

    if (mailboxError || !mailbox) {
      console.error('No pending mailbox found for email:', userEmail);
      console.error('Mailbox error:', mailboxError);
      
      // Also try to find any mailboxes for debugging
      const { data: allMailboxes } = await supabaseClient
        .from('mailboxes')
        .select('email_address, status')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id);
        
      console.log('All user mailboxes:', allMailboxes);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'No pending mailbox found',
          details: `No pending mailbox found for email address: ${userEmail}`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        JSON.stringify({ 
          success: false,
          error: 'Failed to update mailbox status',
          details: updateError.message || 'Database update failed'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: getErrorMessage(error, 'An unexpected error occurred')
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});