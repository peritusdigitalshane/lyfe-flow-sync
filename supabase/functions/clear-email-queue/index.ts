import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting GLOBAL email queue clearance (ALL USERS/MAILBOXES)...');

    // Get count of ALL pending emails across all mailboxes and users
    const { data: pendingEmails, error: emailError } = await supabase
      .from('emails')
      .select('id, subject, created_at, mailbox_id')
      .eq('processing_status', 'pending')
      .order('created_at', { ascending: true })
      .limit(100); // Process larger batches for global clearing

    if (emailError) {
      console.error('Error fetching pending emails:', emailError);
      return new Response(JSON.stringify({ error: 'Failed to fetch emails' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending emails to process',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${pendingEmails.length} pending emails across ALL mailboxes to process`);

    let processedCount = 0;
    let errorCount = 0;
    const results = [];

    // Process each email individually
    for (const email of pendingEmails) {
      try {
        console.log(`Processing email: ${email.id} - "${email.subject}"`);
        
        const response = await supabase.functions.invoke('email-workflow-processor', {
          body: {
            emailId: email.id,
            forceProcess: true
          }
        });

        if (response.error) {
          console.error(`Failed to process email ${email.id}:`, response.error);
          errorCount++;
          results.push({
            email_id: email.id,
            subject: email.subject,
            success: false,
            error: response.error.message || 'Processing failed'
          });
        } else {
          console.log(`Successfully processed email ${email.id}`);
          processedCount++;
          results.push({
            email_id: email.id,
            subject: email.subject,
            success: true
          });
        }

        // Small delay between processing to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Exception processing email ${email.id}:`, error);
        errorCount++;
        results.push({
          email_id: email.id,
          subject: email.subject,
          success: false,
          error: error.message || 'Processing exception'
        });
      }
    }

    console.log(`Queue clearing completed: ${processedCount} processed, ${errorCount} errors`);

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${processedCount} emails from queue`,
      processed: processedCount,
      errors: errorCount,
      results: results,
      batch_size: pendingEmails.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Clear email queue error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});