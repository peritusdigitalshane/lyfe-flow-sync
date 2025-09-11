import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('=== FUNCTION CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  // Simple test response first
  try {
    console.log('=== ATTEMPTING TO READ REQUEST BODY ===');
    const requestBody = await req.json();
    console.log('Request body received:', requestBody);
    
    // Return simple test response for now
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Function is working',
        receivedData: requestBody 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  } catch (error) {
    console.error('=== ERROR IN FUNCTION ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: 'Function error',
        details: error.message,
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});