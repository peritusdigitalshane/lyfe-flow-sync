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

    console.log('Starting automatic processing of pending emails...');

    // Find emails that are stuck in 'pending' status for more than 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: pendingEmails, error: emailError } = await supabase
      .from('emails')
      .select('id, subject, sender_email, mailbox_id, created_at')
      .eq('processing_status', 'pending')
      .lt('created_at', tenMinutesAgo)
      .limit(20); // Process max 20 emails at a time

    if (emailError) {
      console.error('Error fetching pending emails:', emailError);
      return new Response(JSON.stringify({ error: 'Failed to fetch emails' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log('No pending emails found that need processing');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending emails to process',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${pendingEmails.length} pending emails to process`);

    let processedCount = 0;
    let errorCount = 0;
    const results = [];

    // Process each email
    for (const email of pendingEmails) {
      try {
        console.log(`Processing pending email: ${email.id} - "${email.subject}"`);
        
        // Trigger the email workflow processor
        const response = await supabase.functions.invoke('email-workflow-processor', {
          body: {
            emailId: email.id,
            forceProcess: true // Force processing even if it was previously attempted
          }
        });

        if (response.error) {
          console.error(`Failed to process email ${email.id}:`, response.error);
          errorCount++;
          results.push({
            email_id: email.id,
            subject: email.subject,
            success: false,
            error: response.error.message || 'Unknown error'
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
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Exception processing email ${email.id}:`, error);
        errorCount++;
        results.push({
          email_id: email.id,
          subject: email.subject,
          success: false,
          error: error instanceof Error ? error.message : 'Processing exception'
        });
      }
    }

    console.log(`Auto-processing completed: ${processedCount} processed, ${errorCount} errors`);

    return new Response(JSON.stringify({
      success: true,
      message: `Auto-processed ${processedCount} pending emails`,
      processed: processedCount,
      errors: errorCount,
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Auto-process pending emails error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});