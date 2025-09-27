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
    const { tenant_id } = await req.json();
    
    console.log(`🔧 FIXING VIP database for tenant: ${tenant_id}`);

    // Get all VIP email addresses for this tenant
    const { data: vipEmails, error: vipError } = await supabase
      .from('vip_email_addresses')
      .select('email_address')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true);

    if (vipError) {
      console.error('❌ Error fetching VIP emails:', vipError);
      throw vipError;
    }

    if (!vipEmails || vipEmails.length === 0) {
      console.log('⚠️ No VIP emails found for tenant');
      return new Response(
        JSON.stringify({ success: true, message: 'No VIP emails found', updated: 0 }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Found ${vipEmails.length} VIP emails: ${vipEmails.map(v => v.email_address).join(', ')}`);

    let totalUpdated = 0;

    // Update database for ALL VIP emails
    for (const vip of vipEmails) {
      try {
        console.log(`💾 Updating database for VIP: ${vip.email_address}`);
        
        // Update ALL emails from this VIP sender to have is_vip = true
        const { data: updateResult, error: updateError } = await supabase
          .from('emails')
          .update({ is_vip: true })
          .eq('tenant_id', tenant_id)
          .eq('sender_email', vip.email_address)
          .eq('is_vip', false) // Only update those not already VIP
          .select('id');

        if (updateError) {
          console.error(`❌ Error updating VIP status for ${vip.email_address}:`, updateError);
        } else {
          const updatedCount = updateResult?.length || 0;
          console.log(`✅ Updated ${updatedCount} emails to VIP status for ${vip.email_address}`);
          totalUpdated += updatedCount;
        }
      } catch (error) {
        console.error(`❌ Error processing VIP ${vip.email_address}:`, error);
      }
    }

    console.log(`🎉 COMPLETED: Updated ${totalUpdated} emails to VIP status`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${totalUpdated} emails to VIP status`,
        updated: totalUpdated,
        vip_emails_processed: vipEmails.length
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error fixing VIP database:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});