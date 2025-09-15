import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ACTIVATE-USER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get the current user from the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Verify the current user is authenticated
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !currentUser) {
      throw new Error("Invalid authorization");
    }

    logStep("User authenticated", { userId: currentUser.id });

    // Check if current user has admin permissions
    const { data: adminCheck, error: adminError } = await supabaseAdmin
      .rpc('has_role', { _user_id: currentUser.id, _role: 'admin' });

    const { data: superAdminCheck, error: superAdminError } = await supabaseAdmin
      .rpc('has_role', { _user_id: currentUser.id, _role: 'super_admin' });

    if (adminError || superAdminError || (!adminCheck && !superAdminCheck)) {
      throw new Error("Insufficient permissions");
    }

    logStep("Admin permissions verified");

    // Parse request body
    const { userId, email } = await req.json();
    
    if (!userId || !email) {
      throw new Error("Missing userId or email");
    }

    logStep("Activating user", { userId, email });

    // Update account status to active
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ account_status: 'active' })
      .eq("id", userId);

    if (profileError) {
      logStep("Error updating profile", { error: profileError.message });
      throw new Error(`Failed to update profile: ${profileError.message}`);
    }

    // Create or update subscriber record using service role
    const { error: subscriberError } = await supabaseAdmin
      .from("subscribers")
      .upsert({
        user_id: userId,
        email: email,
        subscribed: true,
        subscription_tier: 'manual',
        updated_at: new Date().toISOString()
      });

    if (subscriberError) {
      logStep("Error updating subscriber", { error: subscriberError.message });
      throw new Error(`Failed to update subscriber: ${subscriberError.message}`);
    }

    logStep("User activated successfully", { userId, email });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "User activated successfully" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});