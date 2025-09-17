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
        
        if (text.includes('start recording') || text.includes('begin recording')) {
          return new Response(JSON.stringify({
            type: 'message',
            text: 'Recording started! I\'m now capturing the meeting for transcription and analysis.'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        if (text.includes('stop recording') || text.includes('end recording')) {
          return new Response(JSON.stringify({
            type: 'message',
            text: 'Recording stopped. I\'ll process the meeting transcript and send you a summary shortly.'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        if (text.includes('help') || text.includes('commands')) {
          return new Response(JSON.stringify({
            type: 'message',
            text: `Available commands:
- "Start recording" - Begin meeting recording
- "Stop recording" - End meeting recording  
- "Help" - Show this message
            
I automatically join and record meetings when invited. No manual commands needed!`
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        break;
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