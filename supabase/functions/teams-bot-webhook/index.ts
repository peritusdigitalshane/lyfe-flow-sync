// Force fresh deployment - v2.0
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log('🔥 FUNCTION MODULE LOADED - v2.0');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 WEBHOOK HIT - EXECUTION STARTED v2.0');
  console.log('📞 Method:', req.method);
  console.log('🌐 URL:', req.url);
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  if (req.method === 'OPTIONS') {
    console.log('📋 CORS preflight - returning OK');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('📥 Reading request body...');
    const text = await req.text();
    console.log('📊 Raw body length:', text.length);
    console.log('📝 Raw body preview:', text.substring(0, 200));
    
    const body = JSON.parse(text);
    console.log('✅ JSON parsed successfully');
    console.log('🔍 Activity type:', body?.type);
    console.log('💬 Message text:', body?.text);
    console.log('👤 From:', body?.from?.name);
    
    // ALWAYS return a test response for messages
    if (body?.type === 'message') {
      console.log('🤖 MESSAGE DETECTED - Sending test response');
      const testResponse = {
        type: 'message',
        text: `TEST RESPONSE v2.0: I received "${body?.text || 'no text'}" at ${new Date().toLocaleTimeString()}`
      };
      
      return new Response(JSON.stringify(testResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('📤 Non-message activity - returning 200');
    return new Response('OK v2.0', { 
      status: 200, 
      headers: corsHeaders 
    });
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR:', error);
    console.error('🔍 Error name:', error.name);
    console.error('📋 Error message:', error.message);
    console.error('📚 Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: 'Webhook failed v2.0',
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

console.log('🎯 WEBHOOK FUNCTION READY - v2.0');