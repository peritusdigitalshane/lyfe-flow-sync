console.log("=== TEAMS BOT WEBHOOK v4.0 STARTING ===");

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log("Imports loaded successfully");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("CORS headers defined");

serve(async (req) => {
  console.log("=== WEBHOOK REQUEST RECEIVED ===", req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    console.log("Handling OPTIONS request");
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log("Starting to process webhook...");
    
    const body = await req.json();
    console.log("Request body parsed:", JSON.stringify(body, null, 2));
    
    const { type, text } = body;
    console.log(`Activity type: ${type}, message text: ${text}`);
    
    if (type === 'message' && text) {
      console.log("This is a message activity - Teams bot should respond here");
      
      // For now, just log that we would respond
      console.log("Bot would send response here");
    } else {
      console.log(`Ignoring activity type: ${type}`);
    }

    console.log("Returning successful response");
    return new Response(JSON.stringify({ received: true, type, text }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("ERROR in webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

console.log("=== TEAMS BOT WEBHOOK v4.0 READY ===");