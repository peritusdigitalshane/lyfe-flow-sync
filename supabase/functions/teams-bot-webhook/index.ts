import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("=== TEAMS BOT WEBHOOK v6.0 STARTING - Bot Framework Protocol ===");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("=== BOT FRAMEWORK REQUEST ===", req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse Bot Framework Activity
    const activity = await req.json();
    console.log("Bot Framework Activity received:", JSON.stringify(activity, null, 2));
    
    const { type, text, from, conversation, recipient, serviceUrl, channelId } = activity;
    console.log(`Activity type: ${type}, Channel: ${channelId}`);
    
    // Handle different activity types according to Bot Framework protocol
    if (type === 'message' && text) {
      console.log(`Message from ${from?.name}: "${text}"`);
      
      // Get bot credentials for response
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: settings } = await supabase
        .from('teams_settings')
        .select('microsoft_app_id, microsoft_app_password, bot_enabled')
        .eq('bot_enabled', true)
        .limit(1)
        .maybeSingle();

      if (settings?.microsoft_app_id && settings?.microsoft_app_password) {
        console.log("Bot credentials found, sending response...");
        
        // Get Bot Framework access token
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

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          
          // Send Bot Framework compliant response
          const replyUrl = `${serviceUrl}v3/conversations/${conversation.id}/activities`;
          const replyActivity = {
            type: 'message',
            from: recipient, // Bot becomes the sender in reply
            conversation: conversation,
            recipient: from, // Original sender becomes recipient
            text: `🤖 Hello ${from?.name || 'there'}! I received your message: "${text}"\n\nBot Framework integration is working! ✅\n\nTime: ${new Date().toLocaleTimeString()}`
          };

          console.log("Sending reply to:", replyUrl);
          const replyResponse = await fetch(replyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenData.access_token}`
            },
            body: JSON.stringify(replyActivity)
          });

          if (replyResponse.ok) {
            console.log("✅ Reply sent successfully!");
          } else {
            const errorText = await replyResponse.text();
            console.error("❌ Reply failed:", replyResponse.status, errorText);
          }
        } else {
          console.error("❌ Failed to get Bot Framework token");
        }
      } else {
        console.log("⚠️ No bot credentials configured");
      }
      
    } else if (type === 'conversationUpdate') {
      console.log("Conversation update - member added/removed");
      
    } else {
      console.log(`Ignoring activity type: ${type}`);
    }

    // Always return HTTP 200 for Bot Framework (required)
    console.log("Returning Bot Framework compliant response");
    return new Response('', { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("❌ Bot Framework error:", error);
    // Always return 200 to prevent Bot Framework retries
    return new Response('', { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

console.log("=== BOT FRAMEWORK WEBHOOK v6.0 READY ===");