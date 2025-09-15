import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REPROCESS-EMAILS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting email reprocessing");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get user's tenant_id
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError) throw new Error(`Profile error: ${profileError.message}`);
    const tenantId = profile.tenant_id;
    logStep("Found tenant", { tenantId });

    // Get user's mailboxes
    const { data: mailboxes, error: mailboxError } = await supabaseClient
      .from("mailboxes")
      .select("id, email_address")
      .eq("tenant_id", tenantId)
      .eq("status", "connected");

    if (mailboxError) throw new Error(`Mailbox error: ${mailboxError.message}`);
    if (!mailboxes || mailboxes.length === 0) {
      throw new Error("No connected mailboxes found");
    }
    logStep("Found mailboxes", { count: mailboxes.length });

    // Get the last 50 emails from user's mailboxes
    const mailboxIds = mailboxes.map(m => m.id);
    const { data: emails, error: emailError } = await supabaseClient
      .from("emails")
      .select("id, subject, sender_email, body_content, received_at, mailbox_id, tenant_id")
      .in("mailbox_id", mailboxIds)
      .eq("tenant_id", tenantId)
      .order("received_at", { ascending: false })
      .limit(50);

    if (emailError) throw new Error(`Email fetch error: ${emailError.message}`);
    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No emails found to reprocess",
        processed: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Found emails to reprocess", { count: emails.length });

    // Reset processing status for these emails
    const { error: resetError } = await supabaseClient
      .from("emails")
      .update({ processing_status: "pending", processed_at: null, error_message: null })
      .in("id", emails.map(e => e.id));

    if (resetError) {
      logStep("Error resetting email status", resetError);
    } else {
      logStep("Reset email processing status");
    }

    // Process each email through the workflow system
    let processedCount = 0;
    let errorCount = 0;
    const results = [];

    for (const email of emails) {
      try {
        logStep("Processing email", { 
          emailId: email.id, 
          subject: email.subject?.substring(0, 50) + "...",
          sender: email.sender_email 
        });

        // Call the email workflow processor for each email
        const { data: workflowResult, error: workflowError } = await supabaseClient
          .functions.invoke('email-workflow-processor', {
            body: {
              emailId: email.id,
              mailboxId: email.mailbox_id,
              tenantId: email.tenant_id,
              reprocessing: true
            }
          });

        if (workflowError) {
          logStep("Workflow processing error", { emailId: email.id, error: workflowError });
          errorCount++;
          results.push({
            emailId: email.id,
            status: "error",
            error: workflowError.message
          });
        } else {
          processedCount++;
          results.push({
            emailId: email.id,
            status: "success",
            result: workflowResult
          });
          logStep("Email processed successfully", { emailId: email.id });
        }

        // Add small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        logStep("Error processing email", { emailId: email.id, error: error.message });
        errorCount++;
        results.push({
          emailId: email.id,
          status: "error",
          error: error.message
        });
      }
    }

    logStep("Reprocessing completed", { 
      totalEmails: emails.length,
      processed: processedCount,
      errors: errorCount
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Reprocessed ${processedCount} emails successfully${errorCount > 0 ? `, ${errorCount} errors` : ''}`,
      totalEmails: emails.length,
      processed: processedCount,
      errors: errorCount,
      results: results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in reprocess-emails", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});