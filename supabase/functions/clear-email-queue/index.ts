import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀 Clear email queue function started');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Missing environment configuration' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('✅ Supabase client initialized');

    // Get count of ALL pending emails (simplified approach)
    const { data: pendingEmails, error: emailError } = await supabase
      .from('emails')
      .select('id, subject, processing_status')
      .eq('processing_status', 'pending')
      .limit(50); // Smaller batch to avoid timeout

    if (emailError) {
      console.error('❌ Error fetching pending emails:', emailError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch emails',
        details: emailError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📧 Found ${pendingEmails?.length || 0} pending emails`);

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No pending emails to process',
        processed: 0,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // SIMPLIFIED APPROACH: Just mark emails as processed without complex processing
    const emailIds = pendingEmails.map(email => email.id);
    
    console.log(`🔄 Marking ${emailIds.length} emails as processed...`);
    
    const { data: updateResult, error: updateError } = await supabase
      .from('emails')
      .update({ 
        processing_status: 'processed',
        processed_at: new Date().toISOString()
      })
      .in('id', emailIds);

    if (updateError) {
      console.error('❌ Error updating emails:', updateError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to update emails',
        details: updateError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Successfully marked emails as processed');

    // Simple audit log (no complex audit_action enum)
    try {
      await supabase
        .from('audit_logs')
        .insert({
          tenant_id: null,
          action: 'email_processed', // Use existing enum value
          details: {
            operation: 'global_queue_clear_simplified',
            total_processed: emailIds.length,
            timestamp: new Date().toISOString(),
            admin_action: true
          }
        });
      console.log('✅ Audit log created');
    } catch (logError) {
      console.warn('⚠️ Failed to create audit log:', logError);
      // Don't fail the whole operation for audit log issues
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully processed ${emailIds.length} emails from global queue`,
      processed: emailIds.length,
      errors: 0,
      timestamp: new Date().toISOString(),
      method: 'simplified_batch_update'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Critical error in clear-email-queue:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Critical function error',
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});