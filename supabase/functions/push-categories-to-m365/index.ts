import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('🚀 PUSH CATEGORIES TO M365 FUNCTION CALLED AT:', new Date().toISOString());
  console.log('🔍 Method:', req.method, 'URL:', req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('📋 Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Starting push categories to M365 execution ===');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
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
    const { mailboxId } = requestBody;
    console.log('Request body:', requestBody);

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
          details: profileError?.message || 'Profile is null'
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
          details: mailboxError?.message || 'Mailbox is null'
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

    // Parse the token
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

      parsedToken = await refreshToken(parsedToken, mailboxId, supabase);
      console.log('Token refreshed successfully');
    }

    // Get platform categories for this mailbox/user
    console.log('Fetching platform categories...');
    const { data: platformCategories, error: categoriesError } = await supabase
      .from('email_categories')
      .select('name, color, description')
      .eq('user_id', user.id)
      .eq('tenant_id', profile.tenant_id)
      .or(`mailbox_id.eq.${mailboxId},mailbox_id.is.null`);

    if (categoriesError) {
      console.error('Error fetching platform categories:', categoriesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch platform categories' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Platform categories found:', platformCategories?.length || 0);

    if (!platformCategories || platformCategories.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No platform categories to push',
          pushed: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing M365 categories
    console.log('Fetching M365 categories...');
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/outlook/masterCategories', {
      headers: {
        'Authorization': `Bearer ${parsedToken.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!graphResponse.ok) {
      const errorText = await graphResponse.text();
      console.error('Microsoft Graph API error:', graphResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch M365 categories',
          status: graphResponse.status,
          details: errorText
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const m365Data = await graphResponse.json();
    const m365Categories = m365Data.value || [];
    const existingM365Names = new Set(m365Categories.map((cat: any) => cat.displayName.toLowerCase()));
    
    console.log('M365 categories found:', m365Categories.length);

    // Filter platform categories that don't exist in M365
    const categoriesToPush = platformCategories.filter(cat => 
      !existingM365Names.has(cat.name.toLowerCase())
    );

    console.log('Categories to push to M365:', categoriesToPush.length);

    if (categoriesToPush.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'All platform categories already exist in M365',
          pushed: 0,
          existing: m365Categories.length
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Push each category to M365
    let successCount = 0;
    let errors: string[] = [];

    for (const category of categoriesToPush) {
      try {
        console.log(`Pushing category: ${category.name}`);
        
        const categoryData = {
          displayName: category.name,
          color: category.color || '#3b82f6'
        };

        const createResponse = await fetch('https://graph.microsoft.com/v1.0/me/outlook/masterCategories', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${parsedToken.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(categoryData)
        });

        if (createResponse.ok) {
          successCount++;
          console.log(`Successfully created category: ${category.name}`);
        } else {
          const errorText = await createResponse.text();
          const errorMsg = `Failed to create ${category.name}: ${createResponse.status} - ${errorText}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      } catch (error) {
        const errorMsg = `Error creating ${category.name}: ${error.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    const result = {
      message: `Successfully pushed ${successCount} categories to M365`,
      pushed: successCount,
      total: categoriesToPush.length,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('Push categories result:', result);

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Push categories to M365 error:', error);
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
  
  const expiresAt = Date.now() + (newTokenData.expires_in * 1000);
  const updatedTokenData = {
    access_token: newTokenData.access_token,
    refresh_token: newTokenData.refresh_token || tokenData.refresh_token,
    expires_at: expiresAt
  };

  await supabase
    .from('mailboxes')
    .update({ microsoft_graph_token: JSON.stringify(updatedTokenData) })
    .eq('id', mailboxId);

  console.log('Token refreshed successfully for push categories');
  return updatedTokenData;
}