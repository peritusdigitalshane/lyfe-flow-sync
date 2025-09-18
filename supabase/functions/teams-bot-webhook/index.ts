import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 MINIMAL WEBHOOK TEST - FUNCTION STARTED');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('📋 OPTIONS request - returning CORS headers');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('📥 Processing request...');
    const body = await req.json();
    console.log('✅ JSON parsed successfully');
    console.log('📊 Body type:', typeof body);
    console.log('🔍 Activity type:', body?.type);
    console.log('💬 Message text:', body?.text);
    
    // Simple response for any message
    if (body?.type === 'message') {
      console.log('🤖 Received message, sending simple response');
      return new Response(JSON.stringify({
        type: 'message',
        text: 'Hello! I received your message: ' + (body?.text || 'no text')
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('📤 Non-message activity, returning default response');
    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    });
    
  } catch (error) {
    console.error('❌ ERROR in webhook:', error);
    console.error('📋 Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    return new Response(JSON.stringify({ 
      error: 'Webhook failed',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});