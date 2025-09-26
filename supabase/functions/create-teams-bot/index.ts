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

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Authentication required');
    }

    const { botName, tenantId } = await req.json();

    // Generate Teams App Manifest
    const manifest = {
      "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
      "manifestVersion": "1.16",
      "version": "1.0.0",
      "id": crypto.randomUUID(),
      "packageName": `com.yourcompany.meetingbot.${tenantId}`,
      "developer": {
        "name": "Your Company",
        "websiteUrl": "https://yourcompany.com",
        "privacyUrl": "https://yourcompany.com/privacy",
        "termsOfUseUrl": "https://yourcompany.com/terms"
      },
      "icons": {
        "color": "icon-color.png",
        "outline": "icon-outline.png"
      },
      "name": {
        "short": botName,
        "full": `${botName} - Meeting Assistant`
      },
      "description": {
        "short": "AI-powered meeting assistant for recording and analysis",
        "full": "An intelligent meeting bot that joins Teams meetings to provide transcription, recording, and automated insights including action items and summaries."
      },
      "accentColor": "#0078D4",
      "bots": [
        {
          "botId": "YOUR_BOT_ID_HERE", // This needs to be replaced with actual Microsoft Bot ID
          "scopes": [
            "team",
            "personal",
            "groupchat"
          ],
          "needsChannelSelector": false,
          "isNotificationOnly": false,
          "supportsFiles": false,
          "supportsCalling": true,
          "supportsVideo": true
        }
      ],
      "permissions": [
        "identity",
        "messageTeamMembers"
      ],
      "devicePermissions": [
        "media"
      ],
      "validDomains": [
        "*.ngrok.io", // For development
        "yourcompany.com" // Replace with your actual domain
      ]
    };

    // Check if bot already exists
    const botKey = `teams_bot_${tenantId}`;
    const { data: existingBot } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', botKey)
      .single();

    let botConfig;
    
    if (existingBot) {
      // Update existing bot configuration
      const { data: updatedBot, error: updateError } = await supabase
        .from('app_settings')
        .update({
          value: {
            manifest,
            botName,
            status: 'updated',
            lastUpdated: new Date().toISOString(),
            webhookUrl: `${supabaseUrl}/functions/v1/teams-bot-webhook`
          },
          description: `Teams bot configuration for ${botName}`
        })
        .eq('key', botKey)
        .select()
        .single();

      if (updateError) {
        console.error('Database update error:', updateError);
        throw new Error('Failed to update bot configuration');
      }
      
      botConfig = updatedBot;
    } else {
      // Create new bot configuration
      const { data: newBot, error: insertError } = await supabase
        .from('app_settings')
        .insert({
          tenant_id: tenantId,
          key: botKey,
          value: {
            manifest,
            botName,
            status: 'created',
            createdAt: new Date().toISOString(),
            webhookUrl: `${supabaseUrl}/functions/v1/teams-bot-webhook`
          },
          description: `Teams bot configuration for ${botName}`
        })
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        throw new Error('Failed to store bot configuration');
      }
      
      botConfig = newBot;
    }

    return new Response(JSON.stringify({
      success: true,
      manifest,
      botId: botConfig.id,
      nextSteps: [
        "1. Register a new bot in Azure Bot Service",
        "2. Update the manifest with your actual Bot ID",
        "3. Configure webhook endpoint in Azure",
        "4. Package and deploy to Teams"
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating bot:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});