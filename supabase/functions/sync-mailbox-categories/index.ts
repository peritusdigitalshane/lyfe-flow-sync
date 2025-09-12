import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('🚀 FUNCTION CALLED AT:', new Date().toISOString());
  console.log('🔍 Method:', req.method, 'URL:', req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('📋 Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Starting function execution ===');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('Environment variables check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      urlLength: supabaseUrl?.length || 0
    });
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Supabase client initialized');

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated:', user.id);

    const requestBody = await req.json();
    const { mailboxId, test } = requestBody;
    console.log('Request body:', requestBody);

    // Handle test calls
    if (test) {
      console.log('Test call received');
      return new Response(
        JSON.stringify({ success: true, message: 'Function is available and responding' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!mailboxId) {
      return new Response(
        JSON.stringify({ error: 'Mailbox ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's profile for tenant_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ 
          error: 'User profile not found', 
          details: profileError?.message || 'Profile is null',
          user_id: user.id 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Profile found, tenant_id:', profile.tenant_id);

    // Get mailbox details
    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('microsoft_graph_token, email_address')
      .eq('id', mailboxId)
      .eq('tenant_id', profile.tenant_id)
      .maybeSingle();

    if (mailboxError || !mailbox) {
      console.error('Mailbox error:', mailboxError);
      return new Response(
        JSON.stringify({ 
          error: 'Mailbox not found', 
          details: mailboxError?.message || 'Mailbox is null',
          mailbox_id: mailboxId,
          tenant_id: profile.tenant_id 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!mailbox.microsoft_graph_token) {
      console.error('No Microsoft Graph token found');
      return new Response(
        JSON.stringify({ error: 'Mailbox not connected to Microsoft Graph' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Mailbox found:', mailbox.email_address);

    // Parse the token (it's stored as JSON string)
    let parsedToken;
    try {
      parsedToken = JSON.parse(mailbox.microsoft_graph_token);
    } catch (error) {
      console.error('Failed to parse Microsoft Graph token:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid Microsoft Graph token format' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired and refresh if needed
    const now = Date.now();
    if (parsedToken.expires_at && parsedToken.expires_at <= now) {
      console.log('Token expired, attempting to refresh...');
      
      if (!parsedToken.refresh_token) {
        console.error('No refresh token available');
        return new Response(
          JSON.stringify({ error: 'No refresh token available. Please reconnect your mailbox.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Refresh the token
      parsedToken = await refreshToken(parsedToken, mailboxId, supabase);
      console.log('Token refreshed successfully');
    }

    console.log('Fetching categories from Microsoft Graph API...');

    // Log the full token details (without exposing the actual token)
    console.log('Token details:', {
      hasAccessToken: !!parsedToken.access_token,
      tokenType: typeof parsedToken.access_token,
      tokenLength: parsedToken.access_token?.length,
      expiresAt: parsedToken.expires_at,
      currentTime: now,
      isExpired: parsedToken.expires_at && parsedToken.expires_at <= now
    });

    // Fetch categories from Microsoft Graph API
    console.log('Making request to Microsoft Graph API...');
    console.log('Request URL: https://graph.microsoft.com/v1.0/me/outlook/masterCategories');
    console.log('Authorization header present:', !!parsedToken.access_token);
    
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/outlook/masterCategories', {
      headers: {
        'Authorization': `Bearer ${parsedToken.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Graph API response status:', graphResponse.status);
    console.log('Graph API response ok:', graphResponse.ok);

    if (!graphResponse.ok) {
      const errorText = await graphResponse.text();
      console.error('Microsoft Graph API error:', graphResponse.status, errorText);
      
      // Add more detailed error handling for common issues
      if (graphResponse.status === 403) {
        console.error('403 Forbidden - likely missing MailboxSettings.ReadWrite permission');
        return new Response(
          JSON.stringify({ 
            error: 'Access denied to categories. Please ensure MailboxSettings.ReadWrite permission is granted in your Microsoft App Registration.',
            status: graphResponse.status,
            details: errorText,
            troubleshooting: 'The app needs MailboxSettings.ReadWrite permission to access Outlook categories. Add this permission in Azure Portal and re-authenticate.'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch categories from Microsoft Graph',
          status: graphResponse.status,
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const graphData = await graphResponse.json();
    const categories = graphData.value || [];
    console.log('Categories found:', categories.length);

    // Get existing categories to avoid duplicates
    const { data: existingCategories } = await supabase
      .from('email_categories')
      .select('name')
      .eq('user_id', user.id)
      .eq('tenant_id', profile.tenant_id);

    const existingNames = new Set(existingCategories?.map(c => c.name.toLowerCase()) || []);
    console.log('Existing categories:', existingNames.size);

    // Map Microsoft preset colors to hex values
    const mapPresetToHex = (presetColor: string): string => {
      const colorMap: { [key: string]: string } = {
        'preset0': '#3b82f6',   // blue
        'preset1': '#ef4444',   // red
        'preset2': '#f59e0b',   // amber
        'preset3': '#10b981',   // emerald
        'preset4': '#8b5cf6',   // violet
        'preset5': '#f97316',   // orange
        'preset6': '#06b6d4',   // cyan
        'preset7': '#84cc16',   // lime
        'preset8': '#ec4899',   // pink
        'preset9': '#6b7280',   // gray
        'preset10': '#14b8a6',  // teal
        'preset11': '#f43f5e',  // rose
        'preset12': '#a855f7',  // purple
        'preset13': '#22c55e',  // green
        'preset14': '#eab308',  // yellow
        'preset15': '#dc2626',  // red-600
        'preset16': '#0ea5e9',  // sky
        'preset17': '#7c3aed',  // violet-600
        'preset18': '#059669',  // emerald-600
        'preset19': '#d97706',  // amber-600
        'preset20': '#be185d',  // pink-700
        'preset21': '#4338ca',  // indigo-600
        'preset22': '#0d9488',  // teal-600
        'preset23': '#9333ea',  // purple-600
        'preset24': '#65a30d'   // lime-600
      };
      
      return colorMap[presetColor] || '#3b82f6'; // default to blue
    };

    // Prepare new categories to import
    const newCategories = categories
      .filter((cat: any) => !existingNames.has(cat.displayName.toLowerCase()))
      .map((cat: any) => ({
        name: cat.displayName,
        description: `Imported from ${mailbox.email_address}`,
        color: mapPresetToHex(cat.color) || '#3b82f6',
        priority: 50,
        is_active: true,
        user_id: user.id,
        tenant_id: profile.tenant_id
      }));

    console.log('New categories to import:', newCategories.length);

    if (newCategories.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No new categories to import',
          imported: 0,
          existing: existingCategories?.length || 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert new categories
    const { error: insertError } = await supabase
      .from('email_categories')
      .insert(newCategories);

    if (insertError) {
      console.error('Error inserting categories:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to import categories' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Categories imported successfully');

    return new Response(
      JSON.stringify({ 
        message: 'Categories imported successfully',
        imported: newCategories.length,
        existing: existingCategories?.length || 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync categories error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function refreshToken(tokenData: any, mailboxId: string, supabase: any): Promise<any> {
  const refreshUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  
  const params = new URLSearchParams({
    client_id: '80b5126b-2f86-4a4d-8d55-43afbd7c970e',
    client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET') ?? '',
    scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/MailboxSettings.ReadWrite offline_access',
    refresh_token: tokenData.refresh_token,
    grant_type: 'refresh_token'
  });

  const response = await fetch(refreshUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  const newTokenData = await response.json();
  
  // Update the expires_at timestamp
  const expiresAt = Date.now() + (newTokenData.expires_in * 1000);
  const updatedTokenData = {
    access_token: newTokenData.access_token,
    refresh_token: newTokenData.refresh_token || tokenData.refresh_token,
    expires_at: expiresAt
  };

  // Update the mailbox with new token
  await supabase
    .from('mailboxes')
    .update({ microsoft_graph_token: JSON.stringify(updatedTokenData) })
    .eq('id', mailboxId);

  console.log('Token refreshed successfully for category sync');
  return updatedTokenData;
}