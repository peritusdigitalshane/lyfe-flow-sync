import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log("=== BOT ENDPOINT VALIDATION TEST ===");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const timestamp = new Date().toISOString();
  const url = new URL(req.url);
  
  console.log(`[${timestamp}] ${req.method} ${url.pathname}`);
  console.log("Headers:", Object.fromEntries(req.headers.entries()));
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Handle GET requests (for endpoint validation)
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      status: "Bot endpoint validation successful",
      timestamp: timestamp,
      method: req.method,
      path: url.pathname,
      message: "Azure Bot Service endpoint validation test"
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Handle POST requests (bot messages)
  if (req.method === 'POST') {
    const body = await req.text();
    console.log(`Body: ${body}`);
    
    return new Response(JSON.stringify({
      received: true,
      timestamp: timestamp,
      bodyLength: body.length,
      message: "Bot message received successfully"
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});

console.log("=== BOT ENDPOINT TEST READY ===");