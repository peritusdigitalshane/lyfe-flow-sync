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
    let requestBody: any = {};
    
    if (req.method === 'POST') {
      try {
        requestBody = await req.json();
        if (requestBody.maxEmails && requestBody.maxEmails > 0) {
          maxEmails = Math.min(requestBody.maxEmails, 500); // Cap at 500 for performance
        }
        if (requestBody.hoursBack && requestBody.hoursBack > 0) {
          hoursBack = Math.min(requestBody.hoursBack, 168); // Cap at 1 week
        }
      } catch (e) {
        // If no body or invalid JSON, use defaults
      }
    }

    console.log(`Starting email polling process... maxEmails: ${maxEmails}, hoursBack: ${hoursBack}`);

    // Check if this is an automated call - if so, only poll mailboxes that are due
    let mailboxQuery = supabase
      .from('mailboxes')
      .select(`
        *,
        email_polling_status (
          last_poll_at,
          polling_interval_minutes,
          is_polling_active
        )
      `)
      .eq('status', 'connected')
      .not('microsoft_graph_token', 'is', null);

    const { data: mailboxes, error: mailboxError } = await mailboxQuery;

    if (mailboxError) {
      console.error('Error fetching mailboxes:', mailboxError);
      throw mailboxError;
    }

    console.log(`Found ${mailboxes?.length || 0} active mailboxes to poll`);

    let totalProcessed = 0;
    const results = [];

    for (const mailbox of mailboxes || []) {
      let pollingStatus = null;
      try {
        // Check if polling data exists and if it's time to poll
        pollingStatus = mailbox.email_polling_status?.[0];
        
        // If this is an automated call, check if polling is due
        if (req.method === 'POST') {
          if (requestBody.automated) {
            if (!pollingStatus?.is_polling_active) {
              console.log(`Skipping ${mailbox.email_address} - polling disabled`);
              continue;
            }
            
            // Use last_successful_poll_at for interval checking, not last_poll_at
            const lastSuccessfulPollTime = pollingStatus?.last_successful_poll_at;
            const intervalMinutes = pollingStatus?.polling_interval_minutes || 5;
            
            // If this is the first time polling or enough time has passed since last successful poll
            if (lastSuccessfulPollTime) {
              const timeSinceLastPoll = Date.now() - new Date(lastSuccessfulPollTime).getTime();
              const intervalMs = intervalMinutes * 60 * 1000;
              
              if (timeSinceLastPoll < intervalMs) {
                console.log(`Skipping ${mailbox.email_address} - not due yet (${Math.round(timeSinceLastPoll/1000/60)}min ago, interval: ${intervalMinutes}min)`);
                continue;
              }
            } else {
              console.log(`First time polling for ${mailbox.email_address} - proceeding with email check`);
            }
          }
        }
        
        console.log(`Processing mailbox: ${mailbox.email_address}`);
        const lastPollTime = pollingStatus?.last_successful_poll_at;
        const currentTime = new Date().toISOString();

        // Update polling status - mark as started
        const { error: upsertError } = await supabase
          .from('email_polling_status')
          .upsert({
            tenant_id: mailbox.tenant_id,
            mailbox_id: mailbox.id,
            last_poll_at: currentTime,
            is_polling_active: true
          }, { 
            onConflict: 'tenant_id,mailbox_id',
            ignoreDuplicates: false 
          });

        if (upsertError) {
          console.error('Error updating polling status:', upsertError);
        }

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
                  
                  // Use direct function invocation with proper error handling
                  const workflowResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/email-workflow-processor`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ emailId: insertedEmail.id })
                  });
                  
                  if (!workflowResponse.ok) {
                    const errorText = await workflowResponse.text();
                    console.error(`Workflow processing failed (${workflowResponse.status}):`, errorText);
                  } else {
                    const result = await workflowResponse.json();
                    console.log(`Workflow processing completed for email: ${insertedEmail.id}`, result);
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
        const { error: finalUpsertError } = await supabase
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
          }, { 
            onConflict: 'tenant_id,mailbox_id',
            ignoreDuplicates: false 
          });

        if (finalUpsertError) {
          console.error('Error updating final polling status:', finalUpsertError);
        }

        // Update the mailbox last_sync_at timestamp for dashboard display
        const { error: mailboxUpdateError } = await supabase
          .from('mailboxes')
          .update({ 
            last_sync_at: currentTime 
          })
          .eq('id', mailbox.id);

        if (mailboxUpdateError) {
          console.error('Error updating mailbox last_sync_at:', mailboxUpdateError);
        }

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
        const { error: errorUpsertError } = await supabase
          .from('email_polling_status')
          .upsert({
            tenant_id: mailbox.tenant_id,
            mailbox_id: mailbox.id,
            last_poll_at: new Date().toISOString(),
            errors_count: (pollingStatus?.errors_count || 0) + 1,
            last_error_message: mailboxError instanceof Error ? mailboxError.message : String(mailboxError),
            is_polling_active: true
          }, { 
            onConflict: 'tenant_id,mailbox_id',
            ignoreDuplicates: false 
          });

        if (errorUpsertError) {
          console.error('Error updating error polling status:', errorUpsertError);
        }

        results.push({
          mailbox: mailbox.email_address,
          error: mailboxError instanceof Error ? mailboxError.message : String(mailboxError)
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
  
  // Parse the token data
  let tokenData;
  try {
    tokenData = typeof mailbox.microsoft_graph_token === 'string' 
      ? JSON.parse(mailbox.microsoft_graph_token) 
      : mailbox.microsoft_graph_token;
  } catch (error) {
    throw new Error('Invalid token format');
  }

  // Check if token is expired and refresh if needed
  const currentTime = Date.now();
  if (tokenData.expires_at && currentTime >= tokenData.expires_at) {
    console.log('Token expired, attempting refresh...');
    tokenData = await refreshToken(mailbox, tokenData);
  }

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
      'Authorization': `Bearer ${tokenData.access_token}`,
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

async function refreshToken(mailbox: Mailbox, tokenData: any): Promise<any> {
  const refreshUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  
  const params = new URLSearchParams({
    client_id: '80b5126b-2f86-4a4d-8d55-43afbd7c970e', // Your app's client ID
    client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET') ?? '',
    scope: 'https://graph.microsoft.com/Mail.ReadWrite offline_access',
    refresh_token: tokenData.refresh_token,
    grant_type: 'refresh_token'
  });

  const response = await fetch(refreshUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  const newTokenData = await response.json();
  
  // Update the expires_at timestamp
  const expiresAt = Date.now() + (newTokenData.expires_in * 1000);
  const updatedTokenData = {
    access_token: newTokenData.access_token,
    refresh_token: newTokenData.refresh_token || tokenData.refresh_token,
    expires_at: expiresAt
  };

  // Update the mailbox with new token
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  await supabase
    .from('mailboxes')
    .update({ microsoft_graph_token: JSON.stringify(updatedTokenData) })
    .eq('id', mailbox.id);

  console.log('Token refreshed successfully');
  return updatedTokenData;
}

serve(handler);