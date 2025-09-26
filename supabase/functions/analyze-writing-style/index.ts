import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WritingStyleAnalysis {
  tone: 'formal' | 'casual' | 'friendly' | 'professional';
  avgLength: number;
  commonPhrases: string[];
  formalityLevel: number; // 1-10 scale
  usesBulletPoints: boolean;
  usesEmojis: boolean;
  closingStyle: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get user's mailboxes to analyze sent emails
    const { data: mailboxes } = await supabaseClient
      .from('mailboxes')
      .select('id, microsoft_graph_token, email_address')
      .eq('user_id', user.id)
      .eq('status', 'connected');

    if (!mailboxes || mailboxes.length === 0) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'No connected mailboxes found' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let allSentEmails: any[] = [];

    // Fetch sent emails from Microsoft Graph for each mailbox
    for (const mailbox of mailboxes) {
      try {
        const graphResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me/mailFolders/SentItems/messages?$top=20&$select=subject,body,sentDateTime`,
          {
            headers: {
              'Authorization': `Bearer ${mailbox.microsoft_graph_token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (graphResponse.ok) {
          const data = await graphResponse.json();
          allSentEmails = allSentEmails.concat(data.value || []);
        }
      } catch (error) {
        console.error(`Error fetching emails for mailbox ${mailbox.id}:`, error);
      }
    }

    if (allSentEmails.length === 0) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'No sent emails found for analysis' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Analyzing ${allSentEmails.length} sent emails for writing style...`);

    // Prepare email content for AI analysis
    const emailContents = allSentEmails
      .map(email => email.body?.content || '')
      .filter(content => content.length > 50) // Only analyze substantial emails
      .slice(0, 10); // Limit to 10 recent emails for analysis

    if (emailContents.length === 0) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'No substantial email content found for analysis' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Analyze the following email content samples to determine the user's writing style. 
    Provide analysis in this exact JSON format:
    {
      "tone": "formal|casual|friendly|professional",
      "avgLength": number,
      "commonPhrases": ["phrase1", "phrase2"],
      "formalityLevel": number (1-10 scale, where 1 is very casual, 10 is very formal),
      "usesBulletPoints": boolean,
      "usesEmojis": boolean,
      "closingStyle": "typical closing phrase or style"
    }

    Email samples to analyze:
    ${emailContents.join('\n---\n')}

    Analyze the patterns, tone, formality, common phrases, and typical structure used by this person.`;

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert in communication analysis. Analyze email writing patterns and return valid JSON only.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!openAIResponse.ok) {
      const error = await openAIResponse.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    const analysisText = openAIData.choices[0].message.content.trim();
    
    let writingStyle: WritingStyleAnalysis;
    try {
      writingStyle = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', analysisText);
      // Fallback to default style
      writingStyle = {
        tone: 'professional',
        avgLength: 150,
        commonPhrases: ['Thank you', 'Best regards'],
        formalityLevel: 7,
        usesBulletPoints: false,
        usesEmojis: false,
        closingStyle: 'Best regards'
      };
    }

    // Get user profile for tenant_id
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      throw new Error('User profile not found');
    }

    // Save or update writing style profile
    const { error: upsertError } = await supabaseClient
      .from('user_writing_profiles')
      .upsert({
        user_id: user.id,
        tenant_id: userProfile.tenant_id,
        writing_style: writingStyle,
        last_analyzed_at: new Date().toISOString(),
        emails_analyzed: emailContents.length
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('Error saving writing style:', upsertError);
      throw new Error('Failed to save writing style analysis');
    }

    console.log('Writing style analysis completed and saved');

    return new Response(JSON.stringify({ 
      success: true,
      writingStyle,
      emailsAnalyzed: emailContents.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-writing-style function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});