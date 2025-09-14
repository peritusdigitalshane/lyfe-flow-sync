import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Testing AI features...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    // Test 1: Check OpenAI Configuration
    console.log('Test 1: Checking OpenAI configuration...');
    const { data: openaiConfig, error: configError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'openai_config')
      .single();

    const test1 = {
      name: 'OpenAI Configuration Check',
      status: 'success',
      details: {}
    };

    if (configError || !openaiConfig?.value?.api_key) {
      test1.status = 'failed';
      test1.details = { error: 'OpenAI API key not configured' };
    } else {
      test1.details = { 
        model: openaiConfig.value.model,
        hasApiKey: !!openaiConfig.value.api_key,
        apiKeyPrefix: openaiConfig.value.api_key?.substring(0, 10) + '...'
      };
    }
    results.tests.push(test1);

    // Test 2: Test OpenAI API Connection
    console.log('Test 2: Testing OpenAI API connection...');
    const test2 = {
      name: 'OpenAI API Connection Test',
      status: 'success',
      details: {}
    };

    if (openaiConfig?.value?.api_key) {
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${openaiConfig.value.api_key}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          const models = data.data.map((m: any) => m.id);
          test2.details = { 
            connected: true, 
            availableModels: models.length,
            currentModel: openaiConfig.value.model,
            modelAvailable: models.includes(openaiConfig.value.model.split('-2025-')[0])
          };
        } else {
          test2.status = 'failed';
          test2.details = { error: `API returned ${response.status}` };
        }
      } catch (error) {
        test2.status = 'failed';
        test2.details = { error: error.message };
      }
    } else {
      test2.status = 'failed';
      test2.details = { error: 'No API key configured' };
    }
    results.tests.push(test2);

    // Test 3: Test AI Email Classifier
    console.log('Test 3: Testing AI Email Classifier...');
    const test3 = {
      name: 'AI Email Classifier Test',
      status: 'success',
      details: {}
    };

    try {
      const testEmailData = {
        subject: 'Meeting invitation for tomorrow',
        body: 'Hi, I would like to schedule a meeting with you tomorrow at 2 PM to discuss the project requirements.',
        sender_email: 'colleague@company.com',
        user_id: 'test-user-id'
      };

      const { data: classifierResult, error: classifierError } = await supabase.functions.invoke('ai-email-classifier', {
        body: { emailData: testEmailData }
      });

      if (classifierError) {
        test3.status = 'failed';
        test3.details = { error: classifierError.message };
      } else if (classifierResult?.error) {
        test3.status = 'failed';
        test3.details = { error: classifierResult.error };
      } else {
        test3.details = { 
          classification: classifierResult?.classification,
          success: true
        };
      }
    } catch (error) {
      test3.status = 'failed';
      test3.details = { error: error.message };
    }
    results.tests.push(test3);

    // Test 4: Test AI Condition Evaluator
    console.log('Test 4: Testing AI Condition Evaluator...');
    const test4 = {
      name: 'AI Condition Evaluator Test',
      status: 'success',
      details: {}
    };

    try {
      const testData = {
        condition: 'contains urgent request',
        email: {
          subject: 'URGENT: Please respond immediately',
          sender_email: 'sender@example.com',
          body_content: 'This is an urgent request that needs immediate attention.'
        }
      };

      const { data: conditionResult, error: conditionError } = await supabase.functions.invoke('ai-condition-evaluator', {
        body: testData
      });

      if (conditionError) {
        test4.status = 'failed';
        test4.details = { error: conditionError.message };
      } else if (conditionResult?.error) {
        test4.status = 'failed';
        test4.details = { error: conditionResult.error };
      } else {
        test4.details = { 
          evaluation: conditionResult,
          success: true
        };
      }
    } catch (error) {
      test4.status = 'failed';
      test4.details = { error: error.message };
    }
    results.tests.push(test4);

    console.log('All tests completed:', results);

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in test-ai-features function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});