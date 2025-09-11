import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Auto email scheduler triggered');

    // Get all mailboxes with their polling status
    const { data: mailboxes, error: mailboxError } = await supabase
      .from('mailboxes')
      .select(`
        id,
        email_address,
        email_polling_status (
          last_poll_at,
          polling_interval_minutes,
          is_polling_active
        )
      `)
      .eq('status', 'connected');

    if (mailboxError) {
      console.error('Error fetching mailboxes:', mailboxError);
      throw mailboxError;
    }

    let pollingTriggered = false;
    const currentTime = Date.now();

    for (const mailbox of mailboxes || []) {
      const pollingStatus = mailbox.email_polling_status?.[0];
      
      // Skip if polling is disabled
      if (!pollingStatus?.is_polling_active) {
        continue;
      }

      const intervalMinutes = pollingStatus.polling_interval_minutes || 5;
      const lastPollTime = pollingStatus.last_poll_at;
      
      // Check if it's time to poll
      let shouldPoll = false;
      
      if (!lastPollTime) {
        // Never polled before
        shouldPoll = true;
      } else {
        const timeSinceLastPoll = currentTime - new Date(lastPollTime).getTime();
        const intervalMs = intervalMinutes * 60 * 1000;
        shouldPoll = timeSinceLastPoll >= intervalMs;
      }

      if (shouldPoll) {
        console.log(`Mailbox ${mailbox.email_address} is due for polling (interval: ${intervalMinutes}min)`);
        pollingTriggered = true;
        break; // Only need to find one that's due
      }
    }

    if (pollingTriggered) {
      // Trigger the email poller
      console.log('Triggering email poller...');
      const pollerResponse = await supabase.functions.invoke('email-poller', {
        body: { automated: true }
      });
      
      if (pollerResponse.error) {
        console.error('Error triggering email poller:', pollerResponse.error);
      } else {
        console.log('Email poller triggered successfully');
      }
    } else {
      console.log('No mailboxes due for polling');
    }

    return new Response(JSON.stringify({
      success: true,
      pollingTriggered,
      message: pollingTriggered ? 'Email polling triggered' : 'No polling needed'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in auto-email-scheduler:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
};

serve(handler);