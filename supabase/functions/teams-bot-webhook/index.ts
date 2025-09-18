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
    const { type, conversation, from, recipient, serviceUrl, text } = body;

    // Get bot credentials from database
    const { data: settings } = await supabase
      .from('teams_settings')
      .select('microsoft_app_id, microsoft_app_password, bot_enabled')
      .eq('bot_enabled', true)
      .not('microsoft_app_id', 'is', null)
      .not('microsoft_app_password', 'is', null)
      .neq('microsoft_app_id', '')
      .neq('microsoft_app_password', '')
      .limit(1)
      .maybeSingle();

    if (type === 'message' && settings?.microsoft_app_id && settings?.microsoft_app_password) {
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
        const accessToken = tokenData.access_token;

        // Send reply to Teams
        const replyUrl = `${serviceUrl}v3/conversations/${conversation.id}/activities`;
        const replyPayload = {
          type: 'message',
          from: recipient,
          conversation: conversation,
          recipient: from,
          text: `🤖 Hello! I received your message: "${text}"\n\nBot is working! Time: ${new Date().toLocaleTimeString()}\n\nAvailable commands:\n• Type "help" for assistance\n• Type "hello" for a greeting`
        };

        await fetch(replyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(replyPayload)
        });
      }
    }

    // Always return 200 to Teams
    return new Response('', { 
      status: 200, 
      headers: corsHeaders 
    });

  } catch (error) {
    // Always return 200 to avoid Teams retry loops
    return new Response('', { 
      status: 200, 
      headers: corsHeaders 
    });
  }
});