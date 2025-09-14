import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== UPDATED FUNCTION VERSION 2.0 STARTING ===');
    console.log('Starting email backlog processing...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all emails first
    const { data: allEmails, error: emailError } = await supabase
      .from('emails')
      .select(`
        id, 
        subject, 
        sender_email, 
        received_at,
        mailbox_id
      `)
      .order('received_at', { ascending: false })
      .limit(100);

    if (emailError) {
      console.error('Error fetching emails:', emailError);
      return new Response(JSON.stringify({ error: emailError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get processed email IDs using RPC or simpler query
    const { data: processedEmails, error: processedError } = await supabase
      .from('workflow_executions')
      .select('email_id')
      .not('email_id', 'is', null);

    if (processedError) {
      console.error('Error fetching processed emails:', processedError);
      return new Response(JSON.stringify({ error: processedError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const processedEmailIds = new Set(processedEmails?.map(e => e.email_id) || []);
    console.log(`Found ${processedEmailIds.size} already processed emails out of ${allEmails?.length || 0} total emails`);

    // Filter out processed emails in JavaScript instead of SQL
    const unprocessedEmails = allEmails?.filter(email => !processedEmailIds.has(email.id)) || [];
    const fetchError = null;

    if (fetchError) {
      console.error('Error fetching unprocessed emails:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${unprocessedEmails?.length || 0} unprocessed emails`);

    const results = [];
    let processed = 0;
    let errors = 0;

    if (unprocessedEmails && unprocessedEmails.length > 0) {
      // Process emails in batches to avoid overwhelming the system
      for (let i = 0; i < unprocessedEmails.length; i += 5) {
        const batch = unprocessedEmails.slice(i, i + 5);
        
        await Promise.all(batch.map(async (email) => {
          try {
            console.log(`Processing email: ${email.id} - ${email.subject}`);
            
            const workflowResponse = await fetch(`${supabaseUrl}/functions/v1/email-workflow-processor`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ emailId: email.id })
            });
            
            if (!workflowResponse.ok) {
              const errorText = await workflowResponse.text();
              console.error(`Failed to process email ${email.id}:`, errorText);
              errors++;
            } else {
              console.log(`Successfully processed email: ${email.id}`);
              processed++;
            }
          } catch (error) {
            console.error(`Error processing email ${email.id}:`, error);
            errors++;
          }
        }));

        // Small delay between batches
        if (i + 5 < unprocessedEmails.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    const summary = {
      totalFound: unprocessedEmails?.length || 0,
      processedCount: processed,
      errors,
      message: `Processed ${processed} emails, ${errors} errors`
    };

    console.log('Backlog processing complete:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in process-email-backlog function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});