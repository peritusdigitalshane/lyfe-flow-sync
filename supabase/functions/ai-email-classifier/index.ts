import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailData {
  subject: string;
  body: string;
  sender_email: string;
  sender_name?: string;
  user_id: string;
  mailbox_id?: string;
}

interface ClassificationResult {
  category: string;
  confidence: number;
  reasoning: string;
}

interface EmailCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  priority: number;
  is_active: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('AI Email Classifier: Request received');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get OpenAI API key from app settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'openai_config')
      .single();

    if (settingsError || !settingsData?.value?.api_key) {
      console.error('OpenAI API key not found in settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const openaiApiKey = settingsData.value.api_key;
    let model = settingsData.value.model || 'gpt-4o-mini';
    
    // Fix model name compatibility - remove date suffixes
    if (model.includes('-2025-')) {
      model = model.split('-2025-')[0];
    }

    const { emailData }: { emailData: EmailData } = await req.json();

    if (!emailData.user_id) {
      console.error('User ID is required for classification');
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Classifying email:', { 
      subject: emailData.subject, 
      sender: emailData.sender_email,
      user_id: emailData.user_id,
      mailbox_id: emailData.mailbox_id
    });

    // Fetch user's email categories for the specific mailbox
    let categoriesQuery = supabase
      .from('email_categories')
      .select('id, name, description, color, priority, is_active')
      .eq('user_id', emailData.user_id)
      .eq('is_active', true);

    // If mailbox_id is provided, filter categories for that specific mailbox
    if (emailData.mailbox_id) {
      categoriesQuery = categoriesQuery.or(`mailbox_id.eq.${emailData.mailbox_id},mailbox_id.is.null`);
    }

    categoriesQuery = categoriesQuery.order('priority', { ascending: false });

    const { data: categories, error: categoriesError } = await categoriesQuery;

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user categories' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!categories || categories.length === 0) {
      console.log('No categories found for user/mailbox, cannot classify without categories');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No categories configured',
          message: 'Please create email categories before attempting classification',
          classification: null,
          categories: []
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Found categories for user:', categories.length);

    // Create the classification prompt using user's categories
    const categoryDescriptions = categories.map(cat => 
      `- ${cat.name}: ${cat.description || 'No description provided'}`
    ).join('\n');

    const systemPrompt = `You are an email classifier. Analyze the email content and classify it into one of these categories defined by the user:

${categoryDescriptions}
Respond with a JSON object containing:
- category: the exact category name from the list above
- confidence: a number between 0 and 1 indicating how confident you are
- reasoning: a brief explanation of why you chose this category

Be precise and only use the exact category names provided.`;

    // Prepare the input text for classification
    const inputText = `Subject: ${emailData.subject}\nSender: ${emailData.sender_email}\nEmail Body: ${emailData.body}`;
    const userPrompt = `Classify this email:\n\n${inputText}`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        ...(model.startsWith('gpt-4.1') || model.startsWith('gpt-5') || model.startsWith('o3') || model.startsWith('o4') 
            ? { max_completion_tokens: 300 } 
            : { max_tokens: 300 }),
        ...(model.startsWith('gpt-4.1') || model.startsWith('gpt-5') || model.startsWith('o3') || model.startsWith('o4') 
            ? {} 
            : { temperature: 0.3 }),
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('OpenAI error details:', errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    console.log('OpenAI response:', content);

    // Parse the JSON response
    let classificationResult: ClassificationResult;
    try {
      classificationResult = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      // Fallback classification
      classificationResult = {
        category: "Misc",
        confidence: 0.5,
        reasoning: "Failed to parse AI response, defaulting to Misc"
      };
    }

    // Validate that the category exists in user's categories
    const validCategory = categories.find(cat => cat.name === classificationResult.category);
    if (!validCategory) {
      console.warn('Invalid category returned:', classificationResult.category);
      // Use the first available category as fallback
      const fallbackCategory = categories[0];
      classificationResult.category = fallbackCategory.name;
      classificationResult.confidence = Math.max(0.3, classificationResult.confidence - 0.2);
      classificationResult.reasoning += ` (Adjusted to available category: ${fallbackCategory.name})`;
    }

    console.log('Final classification:', classificationResult);

    return new Response(
      JSON.stringify({
        success: true,
        classification: classificationResult,
        categories: categories
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in AI email classifier:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Classification failed', 
        details: error.message,
        classification: {
          category: categories && categories.length > 0 ? categories[0].name : "Misc",
          confidence: 0.1,
          reasoning: "Error occurred during classification"
        }
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});