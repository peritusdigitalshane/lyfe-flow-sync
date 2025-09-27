import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get auth user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error('Unauthorized');
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', userData.user.id)
      .single();

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Get emails from last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const { data: emails, error } = await supabase
      .from('emails')
      .select('subject, sender_email, sender_name, body_preview, received_at, is_vip, importance, is_read')
      .eq('tenant_id', profile.tenant_id)
      .gte('received_at', yesterday.toISOString())
      .order('received_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({ insights: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Analyzing ${emails.length} emails from last 24 hours`);

    // Prepare email data for AI analysis
    const emailSummaries = emails.map(email => ({
      subject: email.subject,
      sender: email.sender_name || email.sender_email,
      preview: email.body_preview?.substring(0, 200),
      isVip: email.is_vip,
      importance: email.importance,
      isRead: email.is_read,
      receivedHoursAgo: Math.round((Date.now() - new Date(email.received_at).getTime()) / (1000 * 60 * 60))
    }));

    // Call OpenAI to analyze emails for actionable daily insights
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an executive assistant that provides actionable daily email insights to help busy professionals manage their time effectively.

            Analyze the provided emails and generate 3-5 ACTIONABLE insights that save time and improve daily productivity. Focus on:
            
            PRIORITY INSIGHTS:
            - Urgent items requiring immediate response (with sender names)
            - Time-sensitive opportunities or deadlines mentioned in emails
            - Meeting requests that need confirmation today
            - Important decisions waiting for your input
            - Recurring issues that could be automated or delegated
            
            FORMAT GUIDELINES:
            - Be specific with sender names and timeframes
            - Focus on ACTION needed, not just description
            - Prioritize by time sensitivity and business impact
            - Keep insights concise but informative
            - Use "You need to..." or "Consider..." language
            
            EXAMPLES of GOOD insights:
            - "You need to respond to Sarah Johnson's proposal by EOD - she's waiting for your budget approval"
            - "John Smith sent 3 follow-up emails this week - consider scheduling a call to address his concerns"
            - "You have 2 meeting invites for tomorrow morning that conflict - need to reschedule one"
            - "Consider setting up an auto-reply for the 12 similar pricing inquiries you received"
            
            Return a JSON array of insights (strings), maximum 5 items. Focus on TIME-SAVING and PRODUCTIVITY.`
          },
          {
            role: 'user',
            content: `Analyze these emails for actionable daily insights:\n\n${JSON.stringify(emailSummaries, null, 2)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 600
      }),
    });

    if (!aiResponse.ok) {
      console.error('OpenAI API error:', await aiResponse.text());
      throw new Error('Failed to analyze emails');
    }

    const aiData = await aiResponse.json();
    let insights: string[] = [];
    
    try {
      const content = aiData.choices[0].message.content;
      
      // Clean the response - remove markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      
      insights = JSON.parse(cleanedContent);
      
      // Ensure it's an array
      if (!Array.isArray(insights)) {
        insights = [];
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw AI response:', aiData.choices[0].message.content);
      insights = [];
    }

    console.log('Generated insights:', insights);

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in email-insights-analyzer:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});