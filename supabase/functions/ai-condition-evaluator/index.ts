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

    // Get OpenAI API key and model from environment or app settings
    let openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    let selectedModel = 'gpt-4o-mini'; // Final fallback if nothing is configured
    
    // List of commonly available models for fallback
    const fallbackModels = [
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-4.1-mini-2025-04-14',
      'gpt-4.1-2025-04-14'
    ];
    
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
      const configuredModel = openaiConfig.value.model;
      
      // Only use configured model if it's in our reliable list
      if (configuredModel && fallbackModels.includes(configuredModel)) {
        selectedModel = configuredModel;
        console.log(`Using configured model from settings: ${selectedModel}`);
      } else if (configuredModel) {
        console.log(`Configured model ${configuredModel} not in reliable list, using default: ${selectedModel}`);
      } else {
        console.log(`No model configured in settings, using default: ${selectedModel}`);
      }
    }

    // Get custom AI prompts if configured, otherwise use default
    let conditionEvaluatorPrompt = `You are an email classification system. Your task is to evaluate whether an email meets a specific condition.

CONDITION TO EVALUATE: "{condition}"

EMAIL TO ANALYZE:
{email_content}

IMPORTANT GUIDELINES:
- Be EXTREMELY conservative in your evaluation
- Only return true if you are absolutely certain the condition is met
- Consider the exact meaning of the condition, not just general topic similarity
- If there's any ambiguity or uncertainty, return false with low confidence
- Look for specific, concrete evidence that directly matches the condition
- Avoid false positives - it's better to miss a match than create incorrect ones

Based on the email content above, does this email meet the specified condition?

Respond with ONLY a JSON object in this exact format:
{
  "meets_condition": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why the condition is met or not met, including specific evidence"
}

Be precise, conservative, and require strong evidence before returning true.`;

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

    console.log('Using OpenAI model:', selectedModel);
    console.log('Evaluating AI condition:', condition);
    console.log('For email:', email.subject);

    // Prepare request body based on model capabilities
    const requestBody: any = {
      model: selectedModel,
      messages: [
        { 
          role: 'system', 
          content: 'You are a precise email analysis system that evaluates conditions against email content. Always respond with valid JSON only.' 
        },
        { role: 'user', content: prompt }
      ]
    };

    // Handle model-specific parameters
    if (selectedModel.startsWith('gpt-5') || selectedModel.startsWith('o3') || selectedModel.startsWith('o4')) {
      // Newer models use max_completion_tokens and don't support temperature
      requestBody.max_completion_tokens = 200;
    } else {
      // Legacy models use max_tokens and support temperature
      requestBody.max_tokens = 200;
      requestBody.temperature = 0.1; // Low temperature for consistent results
    }

    // Try with primary model, fallback to others if needed
    let response;
    let lastError;
    
    for (const modelToTry of [selectedModel, ...fallbackModels.filter(m => m !== selectedModel)]) {
      try {
        const bodyWithModel = { ...requestBody, model: modelToTry };
        
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyWithModel),
        });

        if (response.ok) {
          console.log(`Successfully used model: ${modelToTry}`);
          break;
        }
        
        const errorData = await response.text();
        lastError = errorData;
        console.warn(`Model ${modelToTry} failed: ${errorData}`);
        
        // Don't retry if it's an auth error
        if (response.status === 401 || response.status === 403) {
          console.error('Authentication error, not retrying other models');
          break;
        }
        
      } catch (fetchError) {
        lastError = fetchError.message;
        console.warn(`Network error with model ${modelToTry}: ${fetchError.message}`);
      }
    }

    if (!response || !response.ok) {
      console.error('All models failed. Last error:', lastError);
      return new Response(
        JSON.stringify({ 
          error: 'AI condition evaluation unavailable',
          fallback_result: {
            meets_condition: false,
            confidence: 0.0,
            reasoning: 'AI evaluation failed, defaulting to false for safety'
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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