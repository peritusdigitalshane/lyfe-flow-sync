import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, getErrorMessage } from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { mailboxId, emailId } = await req.json();

    // Get unprocessed emails for the mailbox
    let query = supabase
      .from('emails')
      .select(`
        id, 
        subject, 
        sender_email, 
        received_at,
        workflow_executions!left(id)
      `)
      .is('workflow_executions.id', null) // Only emails without workflow executions
      .order('received_at', { ascending: false });

    if (emailId) {
      query = query.eq('id', emailId);
    } else if (mailboxId) {
      query = query.eq('mailbox_id', mailboxId);
    }

    const { data: unprocessedEmails, error } = await query.limit(50);

    if (error) {
      console.error('Error fetching unprocessed emails:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Found ${unprocessedEmails?.length || 0} unprocessed emails`);

    const results = [];

    if (unprocessedEmails && unprocessedEmails.length > 0) {
      for (const email of unprocessedEmails) {
        try {
          console.log(`Processing email: ${email.id} - ${email.subject}`);
          
          const workflowResponse = await supabase.functions.invoke('email-workflow-processor', {
            body: { emailId: email.id }
          });
          
          results.push({
            emailId: email.id,
            subject: email.subject,
            success: !workflowResponse.error,
            error: workflowResponse.error?.message || null
          });
          
          if (workflowResponse.error) {
            console.error(`Error processing email ${email.id}:`, workflowResponse.error);
          } else {
            console.log(`Successfully processed email: ${email.id}`);
          }
        } catch (error) {
          console.error(`Error triggering workflow for email ${email.id}:`, error);
          results.push({
            emailId: email.id,
            subject: email.subject,
            success: false,
            error: getErrorMessage(error)
          });
        }
      }
    }

    return new Response(JSON.stringify({ 
      processedCount: results.length,
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in trigger-email-processing function:', error);
    return new Response(JSON.stringify({ error: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});