import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('Sync Categories Function: Request received', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

      // For public client flows, we can't refresh tokens without client credentials
      // The user will need to re-authenticate
      console.error('Token expired and refresh not possible without client credentials');
      return new Response(
        JSON.stringify({ error: 'Token expired. Please reconnect your mailbox.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    }

    console.log('Fetching categories from Microsoft Graph API...');

    // Fetch categories from Microsoft Graph API
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
        JSON.stringify({ error: 'Failed to fetch categories from Microsoft Graph' }),
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

    // Prepare new categories to import
    const newCategories = categories
      .filter((cat: any) => !existingNames.has(cat.displayName.toLowerCase()))
      .map((cat: any) => ({
        name: cat.displayName,
        description: `Imported from ${mailbox.email_address}`,
        color: cat.color || '#3b82f6',
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