import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Teams Bot Webhook received:', JSON.stringify(body, null, 2));

    // Helper function to get Teams settings from database using tenant_id
    const getTeamsSettings = async (tenantId?: string) => {
      if (!tenantId) return null;
      
      try {
        const { data, error } = await supabase
          .from('teams_settings')
          .select('microsoft_app_id, microsoft_app_password')
          .eq('tenant_id', tenantId)
          .maybeSingle();
          
        if (error) {
          console.error('Error fetching Teams settings:', error);
          return null;
        }
        
        return data;
      } catch (error) {
        console.error('Error fetching Teams settings:', error);
        return null;
      }
    };

    // Helper function to get Microsoft Bot Framework access token
    const getAccessToken = async (appId?: string, appPassword?: string) => {
      // Fallback to environment variables if not provided
      const microsoftAppId = appId || Deno.env.get('MICROSOFT_APP_ID');
      const microsoftAppPassword = appPassword || Deno.env.get('MICROSOFT_APP_PASSWORD');
      
      console.log('Auth attempt with App ID:', microsoftAppId?.substring(0, 8) + '...');
      
      if (!microsoftAppId || !microsoftAppPassword) {
        throw new Error('Missing Microsoft App credentials');
      }

      const tokenUrl = 'https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token';
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: microsoftAppId,
        client_secret: microsoftAppPassword,
        scope: 'https://api.botframework.com/.default'
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Failed to get access token:', response.status, error);
        throw new Error(`Failed to get access token: ${response.status} - ${error}`);
      }

      const data = await response.json();
      console.log('Successfully obtained access token');
      return data.access_token;
    };

    // Helper function to send reply to Teams
    const sendReply = async (text: string, teamsSettings?: any) => {
      try {
        console.log('Attempting to send reply with settings:', !!teamsSettings);
        
        const accessToken = await getAccessToken(
          teamsSettings?.microsoft_app_id,
          teamsSettings?.microsoft_app_password
        );
        const replyUrl = `${body.serviceUrl}v3/conversations/${body.conversation.id}/activities`;
        const replyPayload = {
          type: 'message',
          from: body.recipient,
          conversation: body.conversation,
          text: text
        };
        
        console.log('Sending reply to Teams:', { url: replyUrl, hasToken: !!accessToken });
        
        const response = await fetch(replyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(replyPayload)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to send reply:', response.status, errorText);
        } else {
          console.log('Reply sent successfully');
        }
      } catch (error) {
        console.error('Error sending reply:', error);
        // Don't throw here, just log - we want the webhook to return 200
      }
    };

    // Handle different activity types
    const { type, conversation, from, channelData } = body;

    switch (type) {
      case 'conversationUpdate':
        // Bot was added to a conversation/meeting
        if (body.membersAdded) {
          const botAdded = body.membersAdded.some((member: any) => 
            member.id === body.recipient.id
          );
          
          if (botAdded) {
            console.log('Bot added to conversation:', conversation.id);
            
            // Send welcome message
            const welcomeMessage = {
              type: 'message',
              text: `Hello! I'm your meeting assistant. I'll help record and analyze this meeting. You can start the meeting and I'll automatically begin transcription.`,
            };
            
            return new Response(JSON.stringify(welcomeMessage), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
        break;

      case 'invoke':
        // Handle meeting events
        if (body.name === 'application/vnd.microsoft.meetingStart') {
          console.log('Meeting started:', body.value);
          
          // Log meeting start
          await supabase
            .from('meeting_summaries')
            .insert({
              tenant_id: conversation.tenantId || 'default',
              user_id: from.id,
              meeting_id: body.value.meetingId || conversation.id,
              meeting_title: body.value.title || 'Teams Meeting',
              meeting_date: new Date().toISOString(),
              integration_type: 'bot',
              participants: [from.name],
              source_data: {
                conversationId: conversation.id,
                meetingDetails: body.value
              }
            });

          return new Response(JSON.stringify({
            type: 'invoke',
            value: { status: 200 }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (body.name === 'application/vnd.microsoft.meetingEnd') {
          console.log('Meeting ended:', body.value);
          
          // Update meeting record
          await supabase
            .from('meeting_summaries')
            .update({
              duration_minutes: body.value.duration || null,
              updated_at: new Date().toISOString()
            })
            .eq('meeting_id', body.value.meetingId || conversation.id);

          return new Response(JSON.stringify({
            type: 'invoke',
            value: { status: 200 }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        break;

      case 'message':
        // Handle incoming messages/commands
        const text = body.text?.toLowerCase() || '';
        
        // Get Teams settings using tenant ID from the conversation
        const teamsSettings = await getTeamsSettings(conversation.tenantId);
        
        let responseText = '';
        
        if (text.includes('start recording') || text.includes('begin recording')) {
          responseText = 'Recording started! I\'m now capturing the meeting for transcription and analysis.';
        } else if (text.includes('stop recording') || text.includes('end recording')) {
          responseText = 'Recording stopped. I\'ll process the meeting transcript and send you a summary shortly.';
        } else if (text.includes('help') || text.includes('commands')) {
          responseText = `Available commands:
- "Start recording" - Begin meeting recording
- "Stop recording" - End meeting recording  
- "Help" - Show this message
            
I automatically join and record meetings when invited. No manual commands needed!`;
        } else {
          responseText = `Hello! I'm your AI meeting assistant. I can help with:

🎤 Start recording - Begin meeting transcription
🛑 Stop recording - End transcription
❓ Help - Show available commands

Just say "help" to see all commands, or I'll automatically assist when you start a meeting!`;
        }
        
        // Send reply using Teams API
        await sendReply(responseText, teamsSettings);
        
        // Always return 200 OK to Teams
        return new Response('', { status: 200, headers: corsHeaders });
    }

    // Default response
    return new Response(JSON.stringify({
      type: 'message',
      text: 'I\'m here and ready to assist with your meeting!'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Teams Bot Webhook error:', error);
    return new Response(JSON.stringify({ 
      error: 'Webhook processing failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});