import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders, getErrorMessage } from "../_shared/utils.ts";

interface SendReplyRequest {
  mailboxId: string;
  originalEmail: {
    microsoftId: string;
    subject: string;
    senderEmail: string;
  };
  replyContent: string;
  replyId?: string; // ID of the generated reply record to mark as sent
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Initialize Supabase admin client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract JWT token and verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('User authentication failed:', userError?.message);
      throw new Error('User not authenticated');
    }

    const { mailboxId, originalEmail, replyContent, replyId }: SendReplyRequest = await req.json();

    // Get mailbox information and token
    const { data: mailbox } = await supabaseClient
      .from('mailboxes')
      .select('microsoft_graph_token, email_address, display_name')
      .eq('id', mailboxId)
      .eq('user_id', user.id)
      .single();

    if (!mailbox) {
      throw new Error('Mailbox not found or access denied');
    }

    if (!mailbox.microsoft_graph_token) {
      throw new Error('Microsoft Graph token not found for mailbox');
    }

    // Parse the Microsoft Graph token (it's stored as JSON)
    let parsedToken;
    try {
      parsedToken = JSON.parse(mailbox.microsoft_graph_token);
    } catch (error) {
      console.error('Failed to parse Microsoft Graph token:', error);
      throw new Error('Invalid Microsoft Graph token format');
    }

    if (!parsedToken.access_token) {
      throw new Error('Access token not found in Microsoft Graph token data');
    }

    // Prepare the reply email
    const replySubject = originalEmail.subject.startsWith('Re:') 
      ? originalEmail.subject 
      : `Re: ${originalEmail.subject}`;

    const emailMessage = {
      message: {
        subject: replySubject,
        body: {
          contentType: 'HTML',
          content: replyContent.replace(/\n/g, '<br>')
        },
        toRecipients: [
          {
            emailAddress: {
              address: originalEmail.senderEmail
            }
          }
        ]
      }
    };

    console.log(`Sending reply to ${originalEmail.senderEmail} from ${mailbox.email_address}`);
    console.log('Microsoft Graph token present:', !!mailbox.microsoft_graph_token);
    console.log('Mailbox ID:', mailboxId);
    console.log('Original email Microsoft ID:', originalEmail.microsoftId);

    // Send the reply using Microsoft Graph API
    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${originalEmail.microsoftId}/reply`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${parsedToken.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailMessage)
      }
    );

    console.log('Microsoft Graph API response status:', graphResponse.status);
    console.log('Microsoft Graph API response status text:', graphResponse.statusText);

    if (!graphResponse.ok) {
      const errorText = await graphResponse.text();
      console.error('Microsoft Graph API error response:', errorText);
      console.error('Microsoft Graph API error status:', graphResponse.status);
      
      // Try to refresh token if it's expired
      if (graphResponse.status === 401) {
        console.log('Microsoft Graph token appears to be expired');
        throw new Error('Token expired. Please reconnect your mailbox.');
      }
      
      throw new Error(`Failed to send email: ${graphResponse.status} - ${errorText}`);
    }

    const sentEmail = await graphResponse.json();
    console.log('Email sent successfully:', sentEmail.id);

    // Mark the generated reply as sent if replyId provided
    if (replyId) {
      await supabaseClient
        .from('generated_replies')
        .update({ was_sent: true })
        .eq('id', replyId)
        .eq('user_id', user.id);
    }

    // Log the action in audit logs
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userProfile) {
      await supabaseClient
        .from('audit_logs')
        .insert({
          user_id: user.id,
          tenant_id: userProfile.tenant_id,
          mailbox_id: mailboxId,
          action: 'email_reply_sent',
          details: {
            originalEmailId: originalEmail.microsoftId,
            recipientEmail: originalEmail.senderEmail,
            subject: replySubject,
            sentEmailId: sentEmail.id
          }
        });
    }

    return new Response(JSON.stringify({ 
      success: true,
      sentEmailId: sentEmail.id,
      message: 'Reply sent successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in send-email-reply function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: getErrorMessage(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});