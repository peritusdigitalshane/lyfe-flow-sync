import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting automatic VIP processing...');

    // Get all tenants that have VIP emails configured
    const { data: vipEmails, error: vipError } = await supabase
      .from('vip_email_addresses')
      .select('tenant_id')
      .eq('is_active', true);

    if (vipError) {
      console.error('Error fetching VIP emails:', vipError);
      throw vipError;
    }

    if (!vipEmails || vipEmails.length === 0) {
      console.log('No VIP emails found');
      return new Response(
        JSON.stringify({ success: true, message: 'No VIP emails found', processed: 0 }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Get unique tenant IDs
    const uniqueTenantIds = [...new Set(vipEmails.map(v => v.tenant_id))];

    let processedTenants = 0;

    // Process VIP emails for each tenant
    for (const tenantId of uniqueTenantIds) {
      try {
        console.log(`Processing VIP emails for tenant: ${tenantId}`);
        
        // Call the VIP update function for this tenant
        const vipResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/update-vip-status`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'process_mailbox',
            tenant_id: tenantId
          })
        });

        if (vipResponse.ok) {
          console.log(`✅ VIP processing completed for tenant: ${tenantId}`);
          processedTenants++;
        } else {
          console.error(`❌ VIP processing failed for tenant: ${tenantId}`);
        }
      } catch (error) {
        console.error(`Error processing tenant ${tenantId}:`, error);
      }
    }

    console.log(`🎉 Automatic VIP processing completed. Processed ${processedTenants} tenants.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed VIP emails for ${processedTenants} tenants`,
        processed: processedTenants
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error in automatic VIP processing:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});