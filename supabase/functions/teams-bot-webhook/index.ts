import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createRemoteJWKSet, jwtVerify, JWTPayload } from "https://deno.land/x/jose@v4.14.4/index.ts";

console.log("=== TEAMS BOT WEBHOOK v8.0 - SINGLE TENANT AUTHENTICATION ===");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Single Tenant Bot Configuration
const MICROSOFT_APP_ID = Deno.env.get('MICROSOFT_APP_ID');
const APP_TENANT_ID = 'f3f17f7b-5148-44c4-a528-ac9f531a0fc2'; // From your screenshot

console.log(`App ID: ${MICROSOFT_APP_ID}`);
console.log(`Tenant ID: ${APP_TENANT_ID}`);

// JWT verification for Single Tenant authentication
async function verifyJWT(authHeader: string | null): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("❌ No valid Authorization header");
    return false;
  }

  const token = authHeader.substring(7);
  console.log(`🔍 Verifying JWT token (length: ${token.length})`);

  try {
    // Use tenant-specific JWKS endpoint for Single Tenant
    const JWKS = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${APP_TENANT_ID}/discovery/v2.0/keys`)
    );

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://api.botframework.com`,
      audience: MICROSOFT_APP_ID,
    });

    console.log("✅ JWT verified successfully:", {
      iss: payload.iss,
      aud: payload.aud,
      serviceUrl: payload.serviceurl
    });

    return true;
  } catch (error) {
    console.error("❌ JWT verification failed:", error.message);
    return false;
  }
}

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
      message: "Single Tenant authentication configured"
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.text();
    console.log(`Request body (${body.length} chars):`, body);
    
    // Verify JWT for POST requests
    const authHeader = req.headers.get('Authorization');
    const isValidJWT = await verifyJWT(authHeader);
    
    if (!isValidJWT) {
      console.log("❌ JWT validation failed - returning 401");
      return new Response(JSON.stringify({
        error: "Unauthorized - Invalid JWT token",
        timestamp: timestamp
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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

    console.log("✅ Returning successful authenticated response");
    return new Response(JSON.stringify({
      received: true,
      timestamp: timestamp,
      method: req.method,
      bodyLength: body.length,
      authenticated: true,
      message: "Single Tenant Bot Framework webhook received successfully"
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

console.log("=== SINGLE TENANT BOT WEBHOOK v8.0 READY ===");