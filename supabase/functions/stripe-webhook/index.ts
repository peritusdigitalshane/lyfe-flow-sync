import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
    
    // Get the raw body as text for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      throw new Error("Missing stripe-signature header");
    }

    logStep("Verifying webhook signature");
    
    // Verify webhook signature
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    
    logStep("Webhook signature verified", { eventType: event.type });

    // Initialize Supabase client with service role for database operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Handle different webhook events
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Processing checkout.session.completed", { sessionId: session.id, customerEmail: session.customer_email });
        
        if (session.customer_email && session.mode === 'subscription') {
          // Activate the user account
          const { error } = await supabase.rpc('activate_user_account', {
            user_email: session.customer_email
          });
          
          if (error) {
            logStep("Error activating account", { error: error.message, email: session.customer_email });
            throw new Error(`Failed to activate account: ${error.message}`);
          }
          
          logStep("Account activated successfully", { email: session.customer_email });
        }
        break;

      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Processing customer.subscription.deleted", { subscriptionId: subscription.id });
        
        // Get customer email
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        if ('email' in customer && customer.email) {
          // Suspend the user account
          const { error } = await supabase
            .from('profiles')
            .update({ account_status: 'suspended' })
            .eq('email', customer.email);
          
          if (error) {
            logStep("Error suspending account", { error: error.message, email: customer.email });
          } else {
            logStep("Account suspended", { email: customer.email });
          }
          
          // Update subscriber record
          await supabase
            .from('subscribers')
            .update({ subscribed: false, updated_at: new Date().toISOString() })
            .eq('email', customer.email);
        }
        break;

      default:
        logStep("Unhandled webhook event", { eventType: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in webhook", { message: errorMessage });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});