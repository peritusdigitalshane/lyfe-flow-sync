import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ENSURE-VIP-CATEGORIES] ${step}${detailsStr}`);
};

async function refreshToken(tokenData: any, mailboxId: string, supabase: any) {
  if (!tokenData.refresh_token) {
    throw new Error('No refresh token available');
  }

  const refreshUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  const refreshParams = new URLSearchParams({
    client_id: Deno.env.get("MICROSOFT_APP_ID") || '',
    client_secret: Deno.env.get("MICROSOFT_CLIENT_SECRET") || '',
    refresh_token: tokenData.refresh_token,
    grant_type: 'refresh_token',
    scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access'
  });

  const refreshResponse = await fetch(refreshUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: refreshParams.toString()
  });

  if (!refreshResponse.ok) {
    throw new Error(`Token refresh failed: ${refreshResponse.status}`);
  }

  const refreshData = await refreshResponse.json();
  const newTokenData = {
    access_token: refreshData.access_token,
    refresh_token: refreshData.refresh_token || tokenData.refresh_token,
    expires_at: Date.now() + (refreshData.expires_in * 1000)
  };

  // Update the mailbox with the new token
  const { error: updateError } = await supabase
    .from('mailboxes')
    .update({ microsoft_graph_token: JSON.stringify(newTokenData) })
    .eq('id', mailboxId);

  if (updateError) {
    console.error('Failed to update token in database:', updateError);
  }

  return newTokenData;
}

async function ensureVipCategoryForMailbox(mailbox: any, supabase: any): Promise<{ success: boolean; error?: string }> {
  try {
    logStep(`Checking VIP category for mailbox`, { email: mailbox.email_address });

    if (!mailbox.microsoft_graph_token) {
      return { success: false, error: 'No Microsoft Graph token available' };
    }

    // Check if token needs refresh
    let activeToken = mailbox.microsoft_graph_token;
    const tokenData = JSON.parse(mailbox.microsoft_graph_token);
    
    if (tokenData.expires_at && tokenData.expires_at < Date.now()) {
      logStep(`Token expired, refreshing for mailbox`, { email: mailbox.email_address });
      try {
        const refreshedToken = await refreshToken(tokenData, mailbox.id, supabase);
        activeToken = JSON.stringify(refreshedToken);
        logStep(`Token refreshed successfully`);
      } catch (refreshError) {
        const errorMsg = refreshError instanceof Error ? refreshError.message : String(refreshError);
        return { success: false, error: `Token refresh failed: ${errorMsg}` };
      }
    }

    const token = JSON.parse(activeToken).access_token;

    // Check if VIP Important category exists
    logStep(`Fetching existing categories for`, { email: mailbox.email_address });
    const categoriesResponse = await fetch('https://graph.microsoft.com/v1.0/me/outlook/masterCategories', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!categoriesResponse.ok) {
      const errorText = await categoriesResponse.text();
      return { success: false, error: `Failed to fetch categories: ${categoriesResponse.status} - ${errorText}` };
    }

    const categoriesData = await categoriesResponse.json();
    const vipCategoryExists = categoriesData.value?.some((cat: any) => cat.displayName === 'VIP Important');

    if (vipCategoryExists) {
      logStep(`VIP Important category already exists for`, { email: mailbox.email_address });
      return { success: true };
    }

    // Create the VIP Important category
    logStep(`Creating VIP Important category for`, { email: mailbox.email_address });
    const createResponse = await fetch('https://graph.microsoft.com/v1.0/me/outlook/masterCategories', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        displayName: 'VIP Important',
        color: 'preset9' // Orange/Gold color that matches platform VIP styling
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      
      // Handle 409 (Conflict) as success - category already exists
      if (createResponse.status === 409) {
        logStep(`VIP Important category already exists (409 conflict)`, { email: mailbox.email_address });
        return { success: true };
      }
      
      return { success: false, error: `Failed to create VIP category: ${createResponse.status} - ${errorText}` };
    }
    
    logStep(`VIP Important category created successfully for`, { email: mailbox.email_address });
    return { success: true };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return { success: false, error: `Unexpected error: ${errorMsg}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started - ensuring VIP categories for all users");

    // Get all connected mailboxes
    const { data: mailboxes, error: mailboxError } = await supabaseClient
      .from('mailboxes')
      .select('*')
      .eq('status', 'connected')
      .not('microsoft_graph_token', 'is', null);

    if (mailboxError) {
      throw new Error(`Failed to fetch mailboxes: ${mailboxError.message}`);
    }

    if (!mailboxes || mailboxes.length === 0) {
      logStep("No connected mailboxes found");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No connected mailboxes found",
        results: []
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep(`Found ${mailboxes.length} connected mailboxes to process`);

    const results = [];

    // Process each mailbox
    for (const mailbox of mailboxes) {
      const result = await ensureVipCategoryForMailbox(mailbox, supabaseClient);
      results.push({
        email: mailbox.email_address,
        success: result.success,
        error: result.error
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    logStep(`Completed processing all mailboxes`, { 
      total: mailboxes.length,
      success: successCount,
      failures: failureCount
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: `Processed ${mailboxes.length} mailboxes: ${successCount} successful, ${failureCount} failed`,
      results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in ensure-vip-categories", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage,
      results: []
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});