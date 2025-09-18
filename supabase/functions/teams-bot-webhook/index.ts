import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log("=== TEAMS BOT WEBHOOK v7.0 - DIAGNOSTIC MODE ===");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      status: "Bot webhook endpoint is LIVE",
      timestamp: timestamp,
      method: req.method,
      url: req.url,
      message: "If you see this, the Supabase function is working correctly"
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.text();
    console.log(`Request body (${body.length} chars):`, body);
    
    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
      console.log("Parsed JSON successfully:", parsedBody);
    } catch (e) {
      console.log("Could not parse as JSON:", e.message);
    }

    console.log("Returning successful response");
    return new Response(JSON.stringify({
      received: true,
      timestamp: timestamp,
      method: req.method,
      bodyLength: body.length,
      message: "Bot Framework webhook received successfully"
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
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

console.log("=== DIAGNOSTIC BOT WEBHOOK v7.0 READY ===");