import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, getErrorMessage } from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userContext } = await req.json();
    
    if (!message) {
      throw new Error('Message is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    // Get the current user - JWT is already verified by Supabase
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('Authentication failed: ' + (authError?.message || 'User not found'));
    }

    // Get OpenAI API key from app_settings using service role for admin data
    const adminSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    const { data: openaiSettings, error: settingsError } = await adminSupabase
      .from('app_settings')
      .select('value')
      .eq('key', 'openai_config')
      .single();

    if (settingsError || !openaiSettings?.value?.api_key) {
      console.error('OpenAI settings error:', settingsError);
      throw new Error('OpenAI API key not configured in Super Admin settings. Please configure it in the admin panel.');
    }

    const openaiApiKey = openaiSettings.value.api_key;

    // Fetch user's context data
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile?.tenant_id) {
      throw new Error('Unable to fetch user profile');
    }

    const userTenantId = userProfile.tenant_id;
    
    // Get user's mailboxes
    const { data: mailboxes } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('user_id', user.id);

    // Get recent emails
    const { data: recentEmails } = await supabase
      .from('emails')
      .select('subject, sender_email, received_at, processing_status, error_message')
      .eq('tenant_id', userTenantId)
      .order('received_at', { ascending: false })
      .limit(20);

    // Get workflow rules
    const { data: workflowRules } = await supabase
      .from('workflow_rules')
      .select('name, conditions, actions, is_active')
      .eq('tenant_id', userTenantId);

    // Get email categories
    const { data: emailCategories } = await supabase
      .from('email_categories')
      .select('name, description, is_active')
      .eq('user_id', user.id);

    // Get recent workflow executions
    const { data: workflowExecutions } = await supabase
      .from('workflow_executions')
      .select('execution_status, error_message, actions_taken, created_at')
      .eq('tenant_id', userTenantId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get recent audit logs
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('action, details, created_at')
      .eq('tenant_id', userTenantId)
      .order('created_at', { ascending: false })
      .limit(15);

    // Build context for the AI
    const contextData = {
      userEmail: user.email,
      mailboxes: mailboxes?.length || 0,
      recentEmails: recentEmails?.slice(0, 10) || [],
      workflowRules: workflowRules || [],
      emailCategories: emailCategories || [],
      recentExecutions: workflowExecutions || [],
      recentLogs: auditLogs || []
    };

    const systemPrompt = `You are a helpful assistant for an email management platform. You can only help users with platform-related questions and issues.

PLATFORM CONTEXT:
- User Email: ${contextData.userEmail}
- Active Mailboxes: ${contextData.mailboxes}
- Email Categories: ${contextData.emailCategories.map(c => c.name).join(', ')}
- Workflow Rules: ${contextData.workflowRules.length} configured

RECENT PLATFORM ACTIVITY:
Recent Emails: ${JSON.stringify(contextData.recentEmails, null, 2)}
Workflow Executions: ${JSON.stringify(contextData.recentExecutions, null, 2)}
System Logs: ${JSON.stringify(contextData.recentLogs, null, 2)}

CAPABILITIES:
1. Help troubleshoot why emails aren't being processed or categorized
2. Explain how to set up workflow rules and email categories
3. Analyze recent system activity and errors
4. Guide users through platform features
5. Help with mailbox configuration issues

RESTRICTIONS:
- Only answer questions related to this email management platform
- Do not provide information about topics outside the platform
- Focus on user's actual data and configurations
- If asked about non-platform topics, politely redirect to platform assistance

Be concise, helpful, and reference the user's actual data when relevant.`;

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
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error('Failed to get AI response');
    }

    const aiResponse = await response.json();
    const assistantMessage = aiResponse.choices[0].message.content;

    return new Response(JSON.stringify({ 
      response: assistantMessage,
      contextUsed: {
        mailboxCount: contextData.mailboxes,
        categoriesCount: contextData.emailCategories.length,
        rulesCount: contextData.workflowRules.length,
        recentEmailsCount: contextData.recentEmails.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Platform assistant error:', error);
    return new Response(JSON.stringify({ 
      error: getErrorMessage(error, 'Failed to process request') 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});