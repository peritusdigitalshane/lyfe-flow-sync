import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailData {
  id: string;
  subject: string;
  sender_email: string;
  sender_name?: string;
  body_content?: string;
  body_preview?: string;
  importance: string;
  received_at: string;
}

interface AIConditionRequest {
  condition: string;
  email: EmailData;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { condition, email }: AIConditionRequest = await req.json();

    if (!condition || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: condition and email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client for settings lookup
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get OpenAI API key from environment or app settings
    let openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      const { data: openaiConfig, error: configError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'openai_config')
        .maybeSingle();

      if (configError || !openaiConfig?.value?.api_key) {
        return new Response(
          JSON.stringify({ error: 'OpenAI API key not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      openAIApiKey = openaiConfig.value.api_key;
    }

    // Get custom AI prompts if configured, otherwise use default
    let conditionEvaluatorPrompt = `You are an email classification system. Your task is to evaluate whether an email meets a specific condition.

CONDITION TO EVALUATE: "{condition}"

EMAIL TO ANALYZE:
{email_content}

Based on the email content above, does this email meet the specified condition?

Respond with ONLY a JSON object in this exact format:
{
  "meets_condition": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why the condition is met or not met"
}

Be precise and logical in your evaluation. Consider the semantic meaning of the condition, not just literal keyword matches.`;

    const { data: aiPromptsConfig, error: promptsError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_prompts')
      .maybeSingle();

    if (!promptsError && aiPromptsConfig?.value?.condition_evaluator_prompt) {
      conditionEvaluatorPrompt = aiPromptsConfig.value.condition_evaluator_prompt;
      console.log('Using custom condition evaluator prompt');
    }

    // Prepare email content for analysis
    const emailContent = `
Subject: ${email.subject}
From: ${email.sender_name || email.sender_email} (${email.sender_email})
Importance: ${email.importance}
Received: ${email.received_at}
Preview: ${email.body_preview || 'No preview available'}
${email.body_content ? `Content: ${email.body_content.substring(0, 2000)}...` : ''}
    `.trim();

    // Replace placeholders in the prompt
    const prompt = conditionEvaluatorPrompt
      .replace('{condition}', condition)
      .replace('{email_content}', emailContent);

    console.log('Evaluating AI condition:', condition);
    console.log('For email:', email.subject);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are a precise email analysis system that evaluates conditions against email content. Always respond with valid JSON only.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1, // Low temperature for consistent results
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to evaluate condition with AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the AI response
    let evaluationResult;
    try {
      evaluationResult = JSON.parse(aiResponse.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      // Fallback: try to extract boolean result
      const meetsCondition = aiResponse.toLowerCase().includes('true');
      evaluationResult = {
        meets_condition: meetsCondition,
        confidence: 0.5,
        reasoning: 'Unable to parse detailed AI response'
      };
    }

    // Validate the response structure
    if (typeof evaluationResult.meets_condition !== 'boolean') {
      evaluationResult.meets_condition = false;
      evaluationResult.confidence = 0.0;
      evaluationResult.reasoning = 'Invalid AI response format';
    }

    console.log('AI evaluation result:', evaluationResult);

    return new Response(
      JSON.stringify({
        success: true,
        result: evaluationResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-condition-evaluator function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});