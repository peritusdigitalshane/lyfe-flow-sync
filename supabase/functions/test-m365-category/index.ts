import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('🧪 [TEST-M365] Function called at:', new Date().toISOString());

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Test with a known email
    const emailId = '735ed8c7-3417-4c74-9847-9fb03734eef1';
    const categoryId = 'b4b0a6e5-3dde-49ae-94e6-ff8b6a94a700'; // Promotional
    const mailboxId = 'fad85764-4880-42da-bb18-6ac5f17f27e5';

    console.log(`🧪 [TEST-M365] Testing M365 category application`);
    console.log(`📧 Email ID: ${emailId}`);
    console.log(`📋 Category ID: ${categoryId}`);
    console.log(`📫 Mailbox ID: ${mailboxId}`);

    // Get email data
    const { data: email, error: emailError } = await supabase
      .from('emails')
      .select('*')
      .eq('id', emailId)
      .maybeSingle();

    if (emailError || !email) {
      console.error('❌ [TEST-M365] Email not found:', emailError);
      return new Response(
        JSON.stringify({ error: 'Email not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📧 [TEST-M365] Email found: ${email.subject}`);
    console.log(`🔑 [TEST-M365] Microsoft ID: ${email.microsoft_id}`);

    // Get category data
    const { data: category, error: categoryError } = await supabase
      .from('email_categories')
      .select('name')
      .eq('id', categoryId)
      .maybeSingle();

    if (categoryError || !category) {
      console.error('❌ [TEST-M365] Category not found:', categoryError);
      return new Response(
        JSON.stringify({ error: 'Category not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 [TEST-M365] Category found: ${category.name}`);

    // Get mailbox with Microsoft Graph token
    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('microsoft_graph_token')
      .eq('id', mailboxId)
      .maybeSingle();

    if (mailboxError || !mailbox || !mailbox.microsoft_graph_token) {
      console.error('❌ [TEST-M365] Mailbox or token not found:', mailboxError);
      return new Response(
        JSON.stringify({ error: 'Mailbox not connected to Microsoft Graph' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔑 [TEST-M365] Token found, length: ${mailbox.microsoft_graph_token.length}`);

    // Parse the token
    let parsedToken;
    try {
      parsedToken = JSON.parse(mailbox.microsoft_graph_token);
      console.log(`🔑 [TEST-M365] Token parsed, expires at: ${new Date(parsedToken.expires_at || 0).toISOString()}`);
    } catch (error) {
      console.error('❌ [TEST-M365] Failed to parse Microsoft Graph token:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid Microsoft Graph token format' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    const now = Date.now();
    if (parsedToken.expires_at && parsedToken.expires_at <= now) {
      console.log('⚠️ [TEST-M365] Token is expired!');
      return new Response(
        JSON.stringify({ error: 'Token is expired', expired_at: new Date(parsedToken.expires_at).toISOString() }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [TEST-M365] Token is valid`);

    // Test: Get current email details from M365
    console.log(`🔍 [TEST-M365] Fetching email from M365...`);
    const emailUrl = `https://graph.microsoft.com/v1.0/me/messages/${email.microsoft_id}`;
    
    const emailResponse = await fetch(emailUrl, {
      headers: {
        'Authorization': `Bearer ${parsedToken.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error(`❌ [TEST-M365] Failed to fetch email: ${emailResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch email from M365', 
          status: emailResponse.status, 
          details: errorText 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailData = await emailResponse.json();
    console.log(`📧 [TEST-M365] Email fetched successfully`);
    console.log(`📋 [TEST-M365] Current categories: ${JSON.stringify(emailData.categories || [])}`);

    // Test: Apply category to email
    console.log(`🔄 [TEST-M365] Applying category "${category.name}" to email...`);
    
    const updateData = {
      categories: [category.name]
    };

    const updateResponse = await fetch(emailUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${parsedToken.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    console.log(`📥 [TEST-M365] Update response status: ${updateResponse.status}`);

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(`❌ [TEST-M365] Failed to apply category: ${updateResponse.status} - ${errorText}`);
      
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
        console.error(`❌ [TEST-M365] Parsed error:`, errorJson);
      } catch (e) {
        console.error(`❌ [TEST-M365] Error text (not JSON):`, errorText);
      }

      return new Response(
        JSON.stringify({ 
          error: 'Failed to apply category', 
          status: updateResponse.status, 
          details: errorText,
          parsed_error: errorJson || null
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ [TEST-M365] Category applied successfully!`);

    // Verify the change
    const verifyResponse = await fetch(emailUrl, {
      headers: {
        'Authorization': `Bearer ${parsedToken.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    let verificationResult = null;
    if (verifyResponse.ok) {
      const verifiedData = await verifyResponse.json();
      verificationResult = verifiedData.categories || [];
      console.log(`✅ [TEST-M365] Verification: categories are now: ${JSON.stringify(verificationResult)}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        email_id: emailId,
        microsoft_id: email.microsoft_id,
        category_applied: category.name,
        before_categories: emailData.categories || [],
        after_categories: verificationResult,
        message: 'Category applied successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [TEST-M365] Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});