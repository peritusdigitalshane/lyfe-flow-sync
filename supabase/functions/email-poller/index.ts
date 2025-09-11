import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GraphApiEmail {
  id: string;
  subject: string;
  sender: {
    emailAddress: {
      address: string;
      name: string;
    };
  };
  toRecipients: Array<{
    emailAddress: {
      address: string;
      name: string;
    };
  }>;
  body: {
    content: string;
    contentType: string;
  };
  bodyPreview: string;
  receivedDateTime: string;
  isRead: boolean;
  importance: string;
  hasAttachments: boolean;
  parentFolderId: string;
  internetMessageId: string;
  conversationId: string;
}

interface Mailbox {
  id: string;
  tenant_id: string;
  email_address: string;
  microsoft_graph_token: string;
  status: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body for custom parameters
    let maxEmails = 50; // Default
    let hoursBack = null; // Default: only new emails since last poll
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body.maxEmails && body.maxEmails > 0) {
          maxEmails = Math.min(body.maxEmails, 500); // Cap at 500 for performance
        }
        if (body.hoursBack && body.hoursBack > 0) {
          hoursBack = Math.min(body.hoursBack, 168); // Cap at 1 week
        }
      } catch (e) {
        // If no body or invalid JSON, use defaults
      }
    }

    console.log(`Starting email polling process... maxEmails: ${maxEmails}, hoursBack: ${hoursBack}`);

    // Get all active mailboxes that need polling
    const { data: mailboxes, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('status', 'connected')
      .not('microsoft_graph_token', 'is', null);

    if (mailboxError) {
      console.error('Error fetching mailboxes:', mailboxError);
      throw mailboxError;
    }

    console.log(`Found ${mailboxes?.length || 0} active mailboxes to poll`);

    let totalProcessed = 0;
    const results = [];

    for (const mailbox of mailboxes || []) {
      try {
        console.log(`Processing mailbox: ${mailbox.email_address}`);
        
        // Get last poll time for this mailbox
        const { data: pollingStatus } = await supabase
          .from('email_polling_status')
          .select('*')
          .eq('mailbox_id', mailbox.id)
          .single();

        const lastPollTime = pollingStatus?.last_successful_poll_at;
        const currentTime = new Date().toISOString();

        // Update polling status - mark as started
        await supabase
          .from('email_polling_status')
          .upsert({
            tenant_id: mailbox.tenant_id,
            mailbox_id: mailbox.id,
            last_poll_at: currentTime,
            is_polling_active: true
          });

        // Determine the time filter for fetching emails
        let timeFilter = lastPollTime;
        if (hoursBack) {
          const hoursBackTime = new Date();
          hoursBackTime.setHours(hoursBackTime.getHours() - hoursBack);
          timeFilter = hoursBackTime.toISOString();
          console.log(`Using time filter: ${hoursBack} hours back (${timeFilter})`);
        }

        // Fetch emails from Microsoft Graph API
        const emails = await fetchEmailsFromGraph(mailbox, timeFilter, maxEmails);
        console.log(`Fetched ${emails.length} emails from ${mailbox.email_address}`);

        let processedCount = 0;
        let errorCount = 0;
        let lastEmailTime = lastPollTime;

        for (const email of emails) {
          try {
            // Check if email already exists
            const { data: existingEmail } = await supabase
              .from('emails')
              .select('id')
              .eq('microsoft_id', email.id)
              .single();

            if (!existingEmail) {
              // Insert new email
              const { data: insertedEmail, error: insertError } = await supabase
                .from('emails')
                .insert({
                  tenant_id: mailbox.tenant_id,
                  mailbox_id: mailbox.id,
                  microsoft_id: email.id,
                  subject: email.subject || '(No Subject)',
                  sender_email: email.sender?.emailAddress?.address || '',
                  sender_name: email.sender?.emailAddress?.name || '',
                  recipient_emails: email.toRecipients?.map(r => r.emailAddress.address) || [],
                  body_content: email.body?.content || '',
                  body_preview: email.bodyPreview || '',
                  received_at: email.receivedDateTime,
                  is_read: email.isRead || false,
                  importance: email.importance || 'normal',
                  has_attachments: email.hasAttachments || false,
                  folder_id: email.parentFolderId,
                  internet_message_id: email.internetMessageId,
                  conversation_id: email.conversationId,
                  processing_status: 'pending'
                })
                .select('id')
                .single();

              if (insertError) {
                console.error('Error inserting email:', insertError);
                errorCount++;
              } else {
                processedCount++;
                console.log(`New email inserted: ${email.subject} from ${email.sender?.emailAddress?.address}`);
                
                // Track the latest email time
                if (email.receivedDateTime > (lastEmailTime || '')) {
                  lastEmailTime = email.receivedDateTime;
                }

                // Log email received activity
                try {
                  await supabase
                    .from('audit_logs')
                    .insert({
                      tenant_id: mailbox.tenant_id,
                      mailbox_id: mailbox.id,
                      action: 'email_received',
                      details: {
                        email_id: insertedEmail.id,
                        subject: email.subject,
                        sender: email.sender?.emailAddress?.address,
                        received_at: email.receivedDateTime,
                        has_attachments: email.hasAttachments
                      }
                    });
                } catch (auditError) {
                  console.error('Error logging email received activity:', auditError);
                }

                // Trigger workflow processing for the new email
                try {
                  console.log(`Triggering workflow processing for email: ${insertedEmail.id}`);
                  const workflowResponse = await supabase.functions.invoke('email-workflow-processor', {
                    body: { emailId: insertedEmail.id }
                  });
                  
                  if (workflowResponse.error) {
                    console.error('Error processing email workflow:', workflowResponse.error);
                  } else {
                    console.log(`Workflow processing completed for email: ${insertedEmail.id}`);
                  }
                } catch (workflowError) {
                  console.error('Error triggering workflow processor:', workflowError);
                }
              }
            }
          } catch (emailError) {
            console.error('Error processing individual email:', emailError);
            errorCount++;
          }
        }

        // Update polling status with results
        await supabase
          .from('email_polling_status')
          .upsert({
            tenant_id: mailbox.tenant_id,
            mailbox_id: mailbox.id,
            last_poll_at: currentTime,
            last_successful_poll_at: currentTime,
            last_email_received_at: lastEmailTime,
            total_emails_processed: (pollingStatus?.total_emails_processed || 0) + processedCount,
            errors_count: (pollingStatus?.errors_count || 0) + errorCount,
            last_error_message: errorCount > 0 ? `${errorCount} errors during last poll` : null,
            is_polling_active: true
          });

        totalProcessed += processedCount;
        results.push({
          mailbox: mailbox.email_address,
          processed: processedCount,
          errors: errorCount,
          total_fetched: emails.length
        });

      } catch (mailboxError) {
        console.error(`Error processing mailbox ${mailbox.email_address}:`, mailboxError);
        
        // Update polling status with error
        await supabase
          .from('email_polling_status')
          .upsert({
            tenant_id: mailbox.tenant_id,
            mailbox_id: mailbox.id,
            last_poll_at: new Date().toISOString(),
            errors_count: (pollingStatus?.errors_count || 0) + 1,
            last_error_message: mailboxError.message,
            is_polling_active: true
          });

        results.push({
          mailbox: mailbox.email_address,
          error: mailboxError.message
        });
      }
    }

    console.log(`Email polling completed. Total emails processed: ${totalProcessed}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Email polling completed',
      total_processed: totalProcessed,
      mailbox_results: results
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in email-poller function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
};

async function fetchEmailsFromGraph(mailbox: Mailbox, lastPollTime?: string, maxEmails: number = 50): Promise<GraphApiEmail[]> {
  const graphUrl = 'https://graph.microsoft.com/v1.0/me/messages';
  
  // Build query parameters
  const params = new URLSearchParams({
    '$top': maxEmails.toString(),
    '$orderby': 'receivedDateTime desc',
    '$select': 'id,subject,sender,toRecipients,body,bodyPreview,receivedDateTime,isRead,importance,hasAttachments,parentFolderId,internetMessageId,conversationId'
  });

  // Add date filter if we have a last poll time
  if (lastPollTime) {
    params.append('$filter', `receivedDateTime gt ${lastPollTime}`);
  }

  const response = await fetch(`${graphUrl}?${params.toString()}`, {
    headers: {
      'Authorization': `Bearer ${mailbox.microsoft_graph_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Microsoft Graph API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.value || [];
}

serve(handler);