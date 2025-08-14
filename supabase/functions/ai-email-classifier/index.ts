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
}

interface ClassificationResult {
  category: string;
  confidence: number;
  reasoning: string;
}

// Categories matching the n8n workflow
const EMAIL_CATEGORIES = [
  {
    name: "Personal",
    description: "any personal email from friend or family member"
  },
  {
    name: "Junk&Spam", 
    description: "Unsolicited email or spam emails"
  },
  {
    name: "Promotional",
    description: "This is any cold call email looking to sell me something"
  },
  {
    name: "Social",
    description: "Any email from a social media site like, youtube, facebook, instagram"
  },
  {
    name: "Misc",
    description: "Anything that does not get assigned to other categories"
  },
  {
    name: "Alerts",
    description: "Emails that are alerting to items i need to action that i manage"
  },
  {
    name: "Invoices and quotes",
    description: "All invoices and Quotes sent to me"
  },
  {
    name: "BCC/Bidabah",
    description: "if an email is from Biddahbah or BCC or Belmont christian"
  }
];

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
      .eq('key', 'openai_api_key')
      .single();

    if (settingsError || !settingsData?.value) {
      console.error('OpenAI API key not found in settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const openaiApiKey = settingsData.value;
    const { emailData }: { emailData: EmailData } = await req.json();

    console.log('Classifying email:', { 
      subject: emailData.subject, 
      sender: emailData.sender_email 
    });

    // Prepare the input text for classification
    const inputText = `Subject: ${emailData.subject}\nSender: ${emailData.sender_email}\nEmail Body: ${emailData.body}`;

    // Create the classification prompt
    const categoryDescriptions = EMAIL_CATEGORIES.map(cat => 
      `- ${cat.name}: ${cat.description}`
    ).join('\n');

    const systemPrompt = `You are an email classifier. Analyze the email content and classify it into one of these categories:

${categoryDescriptions}

Respond with a JSON object containing:
- category: the exact category name from the list above
- confidence: a number between 0 and 1 indicating how confident you are
- reasoning: a brief explanation of why you chose this category

Be precise and only use the exact category names provided.`;

    const userPrompt = `Classify this email:\n\n${inputText}`;

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 300,
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

    // Validate that the category exists
    const validCategory = EMAIL_CATEGORIES.find(cat => cat.name === classificationResult.category);
    if (!validCategory) {
      console.warn('Invalid category returned:', classificationResult.category);
      classificationResult.category = "Misc";
      classificationResult.confidence = Math.max(0.3, classificationResult.confidence - 0.2);
    }

    console.log('Final classification:', classificationResult);

    return new Response(
      JSON.stringify({
        success: true,
        classification: classificationResult,
        categories: EMAIL_CATEGORIES
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
          category: "Misc",
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