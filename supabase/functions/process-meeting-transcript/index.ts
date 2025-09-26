import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getErrorMessage } from "../_shared/utils.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Authentication required');
    }

    // Get user profile for tenant_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      throw new Error('Failed to get user profile');
    }

    // Parse the form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const meetingTitle = formData.get('meeting_title') as string || 'Uploaded Meeting';
    const meetingDate = formData.get('meeting_date') as string || new Date().toISOString();

    if (!file) {
      throw new Error('No file provided');
    }

    // Read the transcript content
    const transcriptContent = await file.text();
    
    if (!transcriptContent.trim()) {
      throw new Error('Empty transcript file');
    }

    console.log('Processing transcript:', { 
      fileName: file.name, 
      size: file.size, 
      contentLength: transcriptContent.length 
    });

    // Process with OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert meeting analyst. Analyze the provided meeting transcript and extract key information in JSON format.

Your response should be a valid JSON object with the following structure:
{
  "summary": "A comprehensive summary of the meeting (2-3 paragraphs)",
  "key_decisions": ["Decision 1", "Decision 2", ...],
  "action_items": [
    {
      "description": "Action item description", 
      "assigned_to": "Person name or 'Unassigned'",
      "due_date": "YYYY-MM-DD or null",
      "priority": "high|medium|low"
    }
  ],
  "participants": ["Name 1", "Name 2", ...],
  "duration_estimate": 60,
  "effectiveness_score": 85,
  "speaking_time_analysis": {
    "participant_1": { "speaking_time_percent": 25, "contributions": 5 },
    "participant_2": { "speaking_time_percent": 30, "contributions": 8 }
  }
}

Guidelines:
- Extract actual names from the transcript for participants and assignments
- Effectiveness score (0-100) based on clear outcomes, engagement, and productive discussion
- Speaking time analysis should estimate participation levels
- Action items should be specific and actionable
- Due dates should be extracted only if explicitly mentioned`
          },
          {
            role: 'user',
            content: `Please analyze this meeting transcript:\n\n${transcriptContent}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const aiResult = await response.json();
    const analysisContent = aiResult.choices[0].message.content;

    console.log('AI Analysis completed:', analysisContent.substring(0, 200));

    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(analysisContent);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', analysisContent);
      // Fallback analysis if JSON parsing fails
      analysis = {
        summary: analysisContent,
        key_decisions: [],
        action_items: [],
        participants: [],
        duration_estimate: null,
        effectiveness_score: null,
        speaking_time_analysis: {}
      };
    }

    // Save meeting summary to database
    const { data: meetingSummary, error: insertError } = await supabase
      .from('meeting_summaries')
      .insert({
        tenant_id: profile.tenant_id,
        user_id: user.id,
        meeting_id: `uploaded_${Date.now()}`,
        meeting_title: meetingTitle,
        meeting_date: meetingDate,
        duration_minutes: analysis.duration_estimate || null,
        participants: analysis.participants || [],
        transcript: transcriptContent,
        summary: analysis.summary || '',
        action_items: analysis.action_items || [],
        key_decisions: analysis.key_decisions || [],
        speaking_time_analysis: analysis.speaking_time_analysis || {},
        effectiveness_score: analysis.effectiveness_score || null,
        integration_type: 'transcription',
        source_data: {
          file_name: file.name,
          file_size: file.size,
          processed_at: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error('Failed to save meeting summary');
    }

    // Save individual action items
    if (analysis.action_items && Array.isArray(analysis.action_items)) {
      for (const actionItem of analysis.action_items) {
        const { error: actionError } = await supabase
          .from('meeting_action_items')
          .insert({
            tenant_id: profile.tenant_id,
            meeting_summary_id: meetingSummary.id,
            assigned_to: actionItem.assigned_to || null,
            description: actionItem.description,
            due_date: actionItem.due_date ? new Date(actionItem.due_date).toISOString() : null,
            status: 'pending',
            priority: actionItem.priority || 'medium'
          });

        if (actionError) {
          console.error('Failed to insert action item:', actionError);
        }
      }
    }

    console.log('Meeting summary saved successfully:', meetingSummary.id);

    return new Response(JSON.stringify({
      success: true,
      meeting_summary_id: meetingSummary.id,
      summary: analysis.summary,
      action_items_count: analysis.action_items?.length || 0,
      effectiveness_score: analysis.effectiveness_score
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing transcript:', error);
    return new Response(
      JSON.stringify({ 
        error: getErrorMessage(error),
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});