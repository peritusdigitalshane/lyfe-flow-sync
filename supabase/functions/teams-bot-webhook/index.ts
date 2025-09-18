import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("Teams Bot Webhook v3.0 - Starting up...");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log(`Received ${req.method} request to Teams bot webhook`);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("Processing Teams webhook request...");
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("Webhook body:", JSON.stringify(body, null, 2));
    
    const { type, conversation, from, recipient, serviceUrl, text } = body;
    console.log(`Message type: ${type}, text: ${text}`);

    if (type === 'message' && text) {
      console.log("Processing message type activity...");
      
      // Get bot credentials from database
      const { data: settings, error } = await supabase
        .from('teams_settings')
        .select('microsoft_app_id, microsoft_app_password, bot_enabled')
        .eq('bot_enabled', true)
        .not('microsoft_app_id', 'is', null)
        .not('microsoft_app_password', 'is', null)
        .neq('microsoft_app_id', '')
        .neq('microsoft_app_password', '')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching settings:", error);
        return new Response('Settings error', { status: 200, headers: corsHeaders });
      }

      if (!settings) {
        console.log("No bot settings found or bot not enabled");
        return new Response('No settings', { status: 200, headers: corsHeaders });
      }

      console.log(`Found bot settings: App ID = ${settings.microsoft_app_id}`);

      // Get Bot Framework access token
      console.log("Getting Bot Framework token...");
      const tokenResponse = await fetch('https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: settings.microsoft_app_id,
          client_secret: settings.microsoft_app_password,
          scope: 'https://api.botframework.com/.default'
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token request failed:", tokenResponse.status, errorText);
        return new Response('Token error', { status: 200, headers: corsHeaders });
      }

      const tokenData = await tokenResponse.json();
      console.log("Successfully got access token");

      // Send reply to Teams
      const replyUrl = `${serviceUrl}v3/conversations/${conversation.id}/activities`;
      console.log(`Sending reply to: ${replyUrl}`);
      
      const replyPayload = {
        type: 'message',
        from: recipient,
        conversation: conversation,
        recipient: from,
        text: `🤖 Hello! I received your message: "${text}"\n\nBot is working! Time: ${new Date().toLocaleTimeString()}\n\nAvailable commands:\n• Type "help" for assistance\n• Type "hello" for a greeting`
      };

      const replyResponse = await fetch(replyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.access_token}`
        },
        body: JSON.stringify(replyPayload)
      });

      if (!replyResponse.ok) {
        const errorText = await replyResponse.text();
        console.error("Reply failed:", replyResponse.status, errorText);
      } else {
        console.log("Reply sent successfully!");
      }
    } else {
      console.log(`Ignoring activity type: ${type}`);
    }

    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error("Error in Teams webhook:", error);
    return new Response('Error', { 
      status: 200, 
      headers: corsHeaders 
    });
  }
});