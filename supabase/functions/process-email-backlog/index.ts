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
    console.log('Starting email backlog processing...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First get processed email IDs
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

    const processedEmailIds = processedEmails?.map(e => e.email_id) || [];
    console.log(`Found ${processedEmailIds.length} already processed emails`);

    // Find emails without workflow executions
    let query = supabase
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

    // Only add the not filter if there are processed emails to exclude
    if (processedEmailIds.length > 0) {
      query = query.not('id', 'in', processedEmailIds);
    }

    const { data: unprocessedEmails, error: fetchError } = await query;

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