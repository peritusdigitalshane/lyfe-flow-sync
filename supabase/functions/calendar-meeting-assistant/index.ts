import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MeetingRequest {
  meetingId: string;
  mailboxId: string;
  subject: string;
  organizer: string;
  attendees: string[];
  proposedStartTime: string;
  proposedEndTime: string;
  description?: string;
}

interface AlternativeTime {
  start: string;
  end: string;
  dayOfWeek: string;
  timeDescription: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meetingRequest }: { meetingRequest: MeetingRequest } = await req.json();
    console.log('Processing meeting request:', meetingRequest);

    // Get mailbox token for Microsoft Graph API
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const mailboxResponse = await fetch(`${supabaseUrl}/rest/v1/mailboxes?id=eq.${meetingRequest.mailboxId}&select=microsoft_graph_token,email_address`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey!,
        'Content-Type': 'application/json'
      }
    });

    const mailboxData = await mailboxResponse.json();
    const mailbox = mailboxData[0];

    if (!mailbox?.microsoft_graph_token) {
      throw new Error('No Microsoft Graph token found for mailbox');
    }

    const tokenData = JSON.parse(mailbox.microsoft_graph_token);
    const token = tokenData.access_token;
    const proposedStart = new Date(meetingRequest.proposedStartTime);
    const proposedEnd = new Date(meetingRequest.proposedEndTime);
    const duration = proposedEnd.getTime() - proposedStart.getTime();

    // Check availability for the proposed time
    const isAvailable = await checkCalendarAvailability(token, proposedStart, proposedEnd);
    console.log('Proposed time available:', isAvailable);

    if (isAvailable) {
      return new Response(JSON.stringify({
        available: true,
        message: 'Time slot is available',
        action: 'accept'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Find alternative times if not available
    const alternatives = await findAlternativeTimeSlots(token, proposedStart, duration);
    console.log('Found alternatives:', alternatives.length);

    // Generate draft email with alternatives
    const draftEmail = generateAlternativeTimesEmail(
      meetingRequest,
      alternatives,
      mailbox.email_address
    );

    // Store the draft email suggestion
    await fetch(`${supabaseUrl}/rest/v1/generated_replies`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        original_email_id: meetingRequest.meetingId,
        generated_content: draftEmail,
        reply_type: 'meeting_alternative',
        tenant_id: await getUserTenant(meetingRequest.mailboxId, supabaseUrl!, supabaseKey!),
        user_id: await getMailboxUser(meetingRequest.mailboxId, supabaseUrl!, supabaseKey!)
      })
    });

    return new Response(JSON.stringify({
      available: false,
      alternatives,
      draftEmail,
      message: `Found ${alternatives.length} alternative time slots`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in calendar-meeting-assistant:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      available: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

async function checkCalendarAvailability(token: string, startTime: Date, endTime: Date): Promise<boolean> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendar/getSchedule', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        schedules: ['me'],
        startTime: {
          dateTime: startTime.toISOString(),
          timeZone: 'UTC'
        },
        endTime: {
          dateTime: endTime.toISOString(),
          timeZone: 'UTC'
        }
      })
    });

    if (!response.ok) {
      console.error('Calendar API error:', await response.text());
      // Return false if we can't check (assume busy to be safe)
      return false;
    }

    const data = await response.json();
    const busyTimes = data.value[0]?.busyTimes || [];
    
    // Check if proposed time conflicts with any busy periods
    return busyTimes.length === 0;
  } catch (error) {
    console.error('Error checking calendar:', error);
    return false; // Assume busy if error
  }
}

async function findAlternativeTimeSlots(token: string, originalTime: Date, duration: number): Promise<AlternativeTime[]> {
  const alternatives: AlternativeTime[] = [];
  const startOfWeek = new Date(originalTime);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  
  // Check next 2 weeks for alternatives
  for (let weekOffset = 0; weekOffset < 2; weekOffset++) {
    for (let dayOffset = 1; dayOffset < 6; dayOffset++) { // Monday to Friday
      const checkDate = new Date(startOfWeek);
      checkDate.setDate(checkDate.getDate() + (weekOffset * 7) + dayOffset);
      
      // Check common meeting times: 9 AM, 10 AM, 11 AM, 2 PM, 3 PM, 4 PM
      const timeSlots = [9, 10, 11, 14, 15, 16];
      
      for (const hour of timeSlots) {
        const slotStart = new Date(checkDate);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + duration);
        
        // Skip if it's in the past
        if (slotStart < new Date()) continue;
        
        try {
          const isAvailable = await checkCalendarAvailability(token, slotStart, slotEnd);
          
          if (isAvailable) {
            alternatives.push({
              start: slotStart.toISOString(),
              end: slotEnd.toISOString(),
              dayOfWeek: slotStart.toLocaleDateString('en-US', { weekday: 'long' }),
              timeDescription: `${slotStart.toLocaleDateString()} at ${slotStart.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
              })}`
            });
          }
        } catch (error) {
          console.error('Error checking time slot:', error);
        }
        
        // Limit to 5 alternatives
        if (alternatives.length >= 5) break;
      }
      
      if (alternatives.length >= 5) break;
    }
    
    if (alternatives.length >= 5) break;
  }
  
  return alternatives;
}

function generateAlternativeTimesEmail(
  meetingRequest: MeetingRequest, 
  alternatives: AlternativeTime[],
  senderEmail: string
): string {
  const alternativesList = alternatives
    .map((alt, index) => `${index + 1}. ${alt.timeDescription}`)
    .join('\n');

  return `Subject: Re: ${meetingRequest.subject}

Dear ${meetingRequest.organizer},

Thank you for the meeting invitation. Unfortunately, I have a conflict during the proposed time slot (${new Date(meetingRequest.proposedStartTime).toLocaleString()}).

I would be happy to meet at one of these alternative times:

${alternativesList}

Please let me know which option works best for you, and I'll send out a calendar invitation.

Best regards,
${senderEmail}

---
This response was automatically generated based on calendar availability.`;
}

async function getUserTenant(mailboxId: string, supabaseUrl: string, supabaseKey: string): Promise<string> {
  const response = await fetch(`${supabaseUrl}/rest/v1/mailboxes?id=eq.${mailboxId}&select=tenant_id`, {
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  return data[0]?.tenant_id;
}

async function getMailboxUser(mailboxId: string, supabaseUrl: string, supabaseKey: string): Promise<string> {
  const response = await fetch(`${supabaseUrl}/rest/v1/mailboxes?id=eq.${mailboxId}&select=user_id`, {
    headers: {
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  return data[0]?.user_id;
}

serve(handler);