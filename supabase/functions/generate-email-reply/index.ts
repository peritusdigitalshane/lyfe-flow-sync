import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailReplyRequest {
  originalEmail: {
    subject: string;
    senderEmail: string;
    senderName?: string;
    bodyContent: string;
    receivedAt: string;
  };
  replyType: 'quick' | 'professional' | 'friendly' | 'detailed' | 'auto';
  additionalContext?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    console.log('Authorization header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('Missing authorization header');
      throw new Error('No authorization header');
    }

    // Initialize Supabase clients
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get OpenAI API key from app_settings
    const { data: openAISettings } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'openai_api_key')
      .maybeSingle();

    const openAIApiKey = openAISettings?.value;
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured in app settings');
    }

    const { originalEmail, replyType, additionalContext }: EmailReplyRequest = await req.json();

    // Get user's writing style profile
    const { data: profile } = await supabaseClient
      .from('user_writing_profiles')
      .select('writing_style, signature')
      .eq('user_id', user.id)
      .maybeSingle();

    // Get user's profile for tenant info
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('tenant_id, full_name')
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      throw new Error('User profile not found');
    }

    // Build context for AI
    const writingStyle = profile?.writing_style || {};
    const signature = profile?.signature || '';
    
    let stylePrompt = '';
    switch (replyType) {
      case 'quick':
        stylePrompt = 'Write a brief, concise reply. Keep it under 50 words.';
        break;
      case 'professional':
        stylePrompt = 'Write a formal, professional reply with proper business etiquette.';
        break;
      case 'friendly':
        stylePrompt = 'Write a warm, friendly reply that maintains professionalism.';
        break;
      case 'detailed':
        stylePrompt = 'Write a comprehensive, detailed reply that addresses all points thoroughly.';
        break;
      case 'auto':
        stylePrompt = `Match the sender's tone and formality level. Use the user's learned writing style: ${JSON.stringify(writingStyle)}`;
        break;
    }

    const prompt = `You are an AI assistant helping to generate email replies. 

Original Email:
From: ${originalEmail.senderName || originalEmail.senderEmail} (${originalEmail.senderEmail})
Subject: ${originalEmail.subject}
Received: ${originalEmail.receivedAt}
Content: ${originalEmail.bodyContent}

${additionalContext ? `Additional Context: ${additionalContext}` : ''}

Instructions:
${stylePrompt}

User's writing style preferences: ${JSON.stringify(writingStyle)}
User's name: ${userProfile.full_name}

Generate an appropriate email reply. Do not include subject line or email headers, just the body content. 
The reply should be contextual and appropriate to the original email's content and tone.
${signature ? `End with this signature: ${signature}` : ''}

Reply:`;

    console.log('Generating reply with OpenAI...');
    
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful email assistant that generates professional and contextually appropriate email replies.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!openAIResponse.ok) {
      const error = await openAIResponse.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    const generatedReply = openAIData.choices[0].message.content.trim();

    console.log('Reply generated successfully');

    // Log the generated reply
    await supabaseClient
      .from('generated_replies')
      .insert({
        user_id: user.id,
        tenant_id: userProfile.tenant_id,
        original_email_id: originalEmail.subject, // Using subject as identifier for now
        generated_content: generatedReply,
        reply_type: replyType,
        was_sent: false,
        was_edited: false
      });

    return new Response(JSON.stringify({ 
      success: true,
      generatedReply,
      replyType 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-email-reply function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : String(error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});