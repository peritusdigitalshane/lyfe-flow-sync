import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { mailboxId } = await req.json();

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
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get mailbox details
    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('microsoft_graph_token, email_address')
      .eq('id', mailboxId)
      .eq('tenant_id', profile.tenant_id)
      .single();

    if (mailboxError || !mailbox || !mailbox.microsoft_graph_token) {
      return new Response(
        JSON.stringify({ error: 'Mailbox not found or not connected' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch categories from Microsoft Graph API
    const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/outlook/masterCategories', {
      headers: {
        'Authorization': `Bearer ${mailbox.microsoft_graph_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!graphResponse.ok) {
      console.error('Microsoft Graph API error:', await graphResponse.text());
      return new Response(
        JSON.stringify({ error: 'Failed to fetch categories from Microsoft Graph' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const graphData = await graphResponse.json();
    const categories = graphData.value || [];

    // Get existing categories to avoid duplicates
    const { data: existingCategories } = await supabase
      .from('email_categories')
      .select('name')
      .eq('user_id', user.id)
      .eq('tenant_id', profile.tenant_id);

    const existingNames = new Set(existingCategories?.map(c => c.name.toLowerCase()) || []);

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
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});