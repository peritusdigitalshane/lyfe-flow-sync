import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailData {
  id: string;
  sender_email: string;
  tenant_id: string;
  mailbox_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { emails }: { emails: EmailData[] } = await req.json();

    if (!emails || !Array.isArray(emails)) {
      throw new Error('Invalid email data provided');
    }

    console.log(`Processing ${emails.length} emails for VIP status update`);

    for (const email of emails) {
      try {
        // Check if sender email is in VIP list
        const { data: vipData, error: vipError } = await supabaseClient
          .from('vip_email_addresses')
          .select('id')
          .eq('tenant_id', email.tenant_id)
          .eq('email_address', email.sender_email.toLowerCase())
          .eq('is_active', true)
          .single();

        if (vipError && vipError.code !== 'PGRST116') { // PGRST116 = not found
          console.error('Error checking VIP status:', vipError);
          continue;
        }

        const isVip = !!vipData;

        // Update email VIP status
        const { error: updateError } = await supabaseClient
          .from('emails')
          .update({ is_vip: isVip })
          .eq('id', email.id);

        if (updateError) {
          console.error('Error updating email VIP status:', updateError);
          continue;
        }

        if (isVip) {
          console.log(`Marked email ${email.id} as VIP from ${email.sender_email}`);
        }
      } catch (emailError) {
        console.error('Error processing email:', emailError);
        continue;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${emails.length} emails for VIP status` 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error updating VIP status:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to update VIP status', 
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});