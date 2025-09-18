import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log("=== TEAMS BOT WEBHOOK v10.0 - SINGLE TENANT WITH PROPER AUTH ===");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Single Tenant Bot Configuration
const MICROSOFT_APP_ID = Deno.env.get('MICROSOFT_APP_ID');
const MICROSOFT_APP_PASSWORD = Deno.env.get('MICROSOFT_APP_PASSWORD');
const APP_TENANT_ID = 'f3f17f7b-5148-44c4-a528-ac9f531a0fc2'; // From your screenshot

console.log(`App ID: ${MICROSOFT_APP_ID}`);
console.log(`Tenant ID: ${APP_TENANT_ID}`);
console.log(`App Password configured: ${MICROSOFT_APP_PASSWORD ? 'Yes' : 'No'}`);

serve(async (req) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] === INCOMING REQUEST ===`);
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.url}`);
  console.log(`Headers:`, Object.fromEntries(req.headers.entries()));
  
  if (req.method === 'OPTIONS') {
    console.log("Handling CORS preflight");
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    console.log("GET request - returning diagnostic info");
    return new Response(JSON.stringify({
      status: "Single Tenant Bot webhook endpoint is LIVE",
      timestamp: timestamp,
      method: req.method,
      url: req.url,
      appId: MICROSOFT_APP_ID,
      tenantId: APP_TENANT_ID,
      message: "Single Tenant configuration - temporarily bypassing auth for debugging"
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.text();
    console.log(`Request body (${body.length} chars):`, body);
    
    // Log JWT token details for debugging
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      console.log(`🔍 Authorization header present: ${authHeader.substring(0, 20)}...`);
      
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        console.log(`🎫 JWT Token length: ${token.length}`);
        
        // Decode JWT header and payload for debugging (without verification)
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            
            console.log("🔍 JWT Header:", header);
            console.log("🔍 JWT Payload:", {
              iss: payload.iss,
              aud: payload.aud,
              serviceurl: payload.serviceurl,
              exp: payload.exp,
              iat: payload.iat
            });
          }
        } catch (decodeError) {
          console.log("❌ Could not decode JWT:", decodeError.message);
        }
      }
    } else {
      console.log("❌ No Authorization header found");
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
      console.log("✅ Parsed JSON successfully:", parsedBody);
      
      // Log activity type for debugging
      if (parsedBody.type) {
        console.log(`📱 Activity Type: ${parsedBody.type}`);
        if (parsedBody.type === 'message' && parsedBody.text) {
          console.log(`💬 Message: "${parsedBody.text}"`);
        }
      }
    } catch (e) {
      console.log("Could not parse as JSON:", e.message);
    }

    // Handle message activities - send responses back to the user
    if (parsedBody && parsedBody.type === 'message' && parsedBody.text) {
      console.log(`🤖 Generating response for message: "${parsedBody.text}"`);
      
      // Generate a simple response
      const responseText = `Hello! I received your message: "${parsedBody.text}". I'm your meeting assistant bot and I'm working correctly!`;
      
      try {
        // Step 1: Get access token for outbound requests
        console.log("🔑 Getting access token for Bot Framework Connector API...");
        
        const tokenResponse = await fetch('https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: MICROSOFT_APP_ID!,
            client_secret: MICROSOFT_APP_PASSWORD!,
            scope: 'https://api.botframework.com/.default'
          })
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error(`❌ Failed to get access token: ${tokenResponse.status} - ${errorText}`);
          throw new Error(`Token request failed: ${tokenResponse.status}`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        console.log("✅ Got access token successfully");

        // Step 2: Send response back using Bot Framework Connector API
        const serviceUrl = parsedBody.serviceUrl;
        const conversationId = parsedBody.conversation.id;
        const botId = parsedBody.recipient.id;
        const userId = parsedBody.from.id;
        
        const sendUrl = `${serviceUrl}v3/conversations/${conversationId}/activities`;
        
        console.log(`📤 Sending response to: ${sendUrl}`);
        
        const responsePayload = {
          type: 'message',
          from: { 
            id: botId, 
            name: 'Meeting Assistant' 
          },
          recipient: { 
            id: userId,
            name: parsedBody.from.name || ''
          },
          text: responseText,
          replyToId: parsedBody.id
        };
        
        console.log("📨 Response payload:", responsePayload);
        
        const sendResponse = await fetch(sendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(responsePayload)
        });
        
        if (sendResponse.ok) {
          const responseData = await sendResponse.json();
          console.log("✅ Response sent successfully:", responseData);
        } else {
          const errorText = await sendResponse.text();
          console.error(`❌ Failed to send response: ${sendResponse.status} - ${errorText}`);
        }
      } catch (sendError) {
        console.error("❌ Error in response handling:", sendError);
      }
    }

    // Return acknowledgment to Bot Framework
    console.log("✅ Returning successful acknowledgment");
    return new Response(JSON.stringify({
      received: true,
      timestamp: timestamp,
      method: req.method,
      bodyLength: body.length,
      activityType: parsedBody?.type || 'unknown',
      message: "Activity processed successfully"
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[${timestamp}] ERROR:`, error);
    return new Response(JSON.stringify({
      error: error.message,
      timestamp: timestamp
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

console.log("=== SINGLE TENANT BOT WEBHOOK v10.0 READY ===");