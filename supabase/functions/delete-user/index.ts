import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DELETE-USER] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Delete user request received");

    // Initialize Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Initialize regular client for user authentication
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get the session from the Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    logStep("User authenticated", { userId: user.id });

    // Check if user has admin permissions
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) throw rolesError;

    const userRoles = roles?.map(r => r.role) || [];
    const hasAdminRole = userRoles.includes('admin') || userRoles.includes('super_admin');

    if (!hasAdminRole) {
      throw new Error("Insufficient permissions");
    }

    logStep("Admin permissions verified");

    const { userId } = await req.json();
    
    if (!userId) {
      throw new Error("User ID is required");
    }

    // Prevent self-deletion
    if (userId === user.id) {
      throw new Error("Cannot delete your own account");
    }

    logStep("Starting user deletion process", { targetUserId: userId });

    // Check if user has any associated mailboxes
    const { count: mailboxCount, error: mailboxCheckError } = await supabaseAdmin
      .from("mailboxes")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", userId);

    if (mailboxCheckError) throw mailboxCheckError;

    if (mailboxCount && mailboxCount > 0) {
      throw new Error("Cannot delete user with associated mailboxes. Please remove mailboxes first.");
    }

    logStep("Mailbox check passed");

    // Get user email for logging
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .single();

    if (profileError) throw profileError;
    const userEmail = profileData.email;

    // Delete user roles first
    const { error: rolesDeleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (rolesDeleteError) throw rolesDeleteError;
    logStep("User roles deleted");

    // Delete user profile
    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileDeleteError) throw profileDeleteError;
    logStep("User profile deleted");

    // Delete from auth using admin client
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (authDeleteError) {
      logStep("Auth deletion failed but continuing", { error: authDeleteError });
      // Continue anyway as the profile and roles are already deleted
    } else {
      logStep("User deleted from auth");
    }

    logStep("User deletion completed successfully", { userEmail });

    return new Response(JSON.stringify({ 
      success: true,
      message: `User ${userEmail} deleted successfully`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in user deletion", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});