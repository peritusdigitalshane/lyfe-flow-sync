import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailAnalysis {
  risk_score: number;
  category: string;
  confidence: number;
  analysis_details: {
    suspicious_patterns: string[];
    risk_factors: Array<{
      factor: string;
      score: number;
      description: string;
    }>;
    category_indicators: string[];
  };
}

interface WorkflowCondition {
  field: 'subject' | 'sender_email' | 'body_content' | 'has_attachments' | 'risk_score' | 'category' | 'ai_analysis';
  operator: 'contains' | 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'starts_with' | 'ends_with' | 'ai_condition';
  value: string | number | boolean;
  case_sensitive?: boolean;
}

interface WorkflowAction {
  type: 'categorize' | 'categorise' | 'quarantine' | 'move_to_folder' | 'mark_as_read' | 'send_notification' | 'delete' | 'forward';
  parameters: Record<string, any>;
}

interface WorkflowRule {
  id: string;
  name: string;
  tenant_id: string;
  mailbox_id?: string;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  is_active: boolean;
  priority: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { emailId, forceProcess = false } = await req.json();

    if (!emailId) {
      return new Response(JSON.stringify({ error: 'Email ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get email details
    const { data: email, error: emailError } = await supabase
      .from('emails')
      .select('*')
      .eq('id', emailId)
      .single();

    if (emailError || !email) {
      console.error('Error fetching email:', emailError);
      return new Response(JSON.stringify({ error: 'Email not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Skip if already processed (unless force processing)
    if (email.processing_status === 'processed' && !forceProcess) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Email already processed',
        email_id: emailId 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const startTime = Date.now();

    console.log('Starting enhanced email workflow processing...');

    // Initialize analysis early to prevent scope issues
    let analysis: EmailAnalysis = analyzeEmail(email);

    // Step 1: Check global quarantine settings
    const { data: quarantineConfig, error: quarantineError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'quarantine_config')
      .maybeSingle();

    let shouldCheckQuarantine = false;
    let quarantineSettings: any = {};

    if (!quarantineError && quarantineConfig?.value) {
      quarantineSettings = quarantineConfig.value;
      shouldCheckQuarantine = quarantineSettings.enabled === true;
      console.log('Quarantine system enabled:', shouldCheckQuarantine);
      console.log('AI quarantine enabled:', quarantineSettings.ai_enabled);
    }

    // Step 2: Check if user has Security module access before threat intelligence
    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('user_id')
      .eq('id', email.mailbox_id)
      .single();

    if (mailboxError) {
      console.error('Error fetching mailbox:', mailboxError);
      // Continue processing without threat intelligence
    }

    let userHasSecurityModule = false;
    if (mailbox?.user_id) {
      const { data: hasSecurityAccess, error: securityError } = await supabase
        .rpc('user_has_module_access', { 
          _user_id: mailbox.user_id, 
          _module: 'security' 
        });

      if (!securityError && hasSecurityAccess) {
        userHasSecurityModule = true;
        console.log('User has Security module access - threat intelligence enabled');
      } else {
        console.log('User does not have Security module access - skipping threat intelligence');
      }
    }

    // Step 3: Enhanced threat intelligence check (only if user has Security module)
    if (userHasSecurityModule && (shouldCheckQuarantine || quarantineSettings.threat_intelligence_enabled)) {
      try {
        console.log('Running threat intelligence check...');
        
        // Add timeout for threat intelligence check to prevent blocking
        const threatIntelPromise = supabase.functions.invoke('threat-intelligence-checker', {
          body: {
            email_id: email.id,
            email_content: {
              subject: email.subject,
              sender_email: email.sender_email,
              body_content: email.body_content,
              body_preview: email.body_preview
            },
            tenant_id: email.tenant_id
          }
        });

        // Race the threat intelligence check against a timeout
        const threatIntelResponse = await Promise.race([
          threatIntelPromise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Threat intelligence timeout')), 30000) // 30 second timeout
          )
        ]) as any;

        if (!threatIntelResponse.error && threatIntelResponse.data?.success) {
          const threatResult = threatIntelResponse.data.result;
          console.log(`Threat intelligence check completed. Threats: ${threatResult.threats_detected}, Max Score: ${threatResult.max_threat_score}`);
          
          // Add threat intelligence results to analysis
          if (threatResult.threats_detected > 0) {
            analysis.risk_score = Math.max(analysis.risk_score, threatResult.max_threat_score);
            analysis.analysis_details.suspicious_patterns.push(...(threatResult.threat_details?.map(t => t.threat_indicator) || []));
            analysis.analysis_details.risk_factors.push({
              factor: 'threat_intelligence',
              score: threatResult.max_threat_score,
              description: `${threatResult.threats_detected} threats detected from intelligence feeds`
            });

            // Auto-quarantine if threat intelligence indicates high risk
            if (threatResult.should_quarantine) {
              console.log('Threat intelligence triggered quarantine');
              await quarantineEmail(email, supabase, `Threat intelligence: ${threatResult.threats_detected} threats detected (score: ${threatResult.max_threat_score})`);
              
              await logWorkflowExecution(email, null, [{ 
                type: 'quarantine', 
                parameters: { 
                  reason: 'Threat intelligence detection',
                  threat_details: threatResult.threat_details
                } 
              }], startTime, supabase);
              
              return createResponse(true, emailId, analysis, [{ 
                type: 'quarantine', 
                parameters: { 
                  reason: 'Threat intelligence detection',
                  threats: threatResult.threats_detected
                } 
              }], null, startTime);
            }
          }
        } else {
          console.warn('Threat intelligence check failed, continuing with basic analysis:', threatIntelResponse?.error || 'No results');
        }
      } catch (error) {
        console.warn('Threat intelligence check failed (timeout or error), continuing with basic analysis:', error.message);
        // Continue processing - don't let threat intelligence failures block email processing
        if (analysis && analysis.analysis_details) {
          analysis.analysis_details.risk_factors.push({
            factor: 'threat_intelligence_error',
            score: 0,
            description: 'Threat intelligence check failed, processed with basic analysis only'
          });
        }
      }
    }

    // Step 3: Pre-quarantine checks (before AI analysis)
    if (shouldCheckQuarantine) {
      const preQuarantineResult = await checkPreQuarantineRules(email, quarantineSettings);
      if (preQuarantineResult.shouldQuarantine) {
        console.log('Pre-quarantine triggered:', preQuarantineResult.reason);
        await quarantineEmail(email, supabase, preQuarantineResult.reason);
        
        // Log and return early
        await logWorkflowExecution(email, null, [{ type: 'quarantine', parameters: { reason: preQuarantineResult.reason } }], startTime, supabase);
        return createResponse(true, emailId, null, [{ type: 'quarantine', parameters: { reason: preQuarantineResult.reason } }], null, startTime);
      }
    }

    // Step 4: Enhanced AI Analysis (update the initial analysis)
    try {
      if (shouldCheckQuarantine && quarantineSettings.ai_enabled) {
        // Enhanced AI analysis for quarantine
        const aiResult = await performAIThreatAnalysis(email, quarantineSettings, supabase);
        analysis = aiResult;
        
        // Check if AI analysis triggers quarantine
        if (aiResult.risk_score >= (quarantineSettings.risk_threshold || 70)) {
          console.log(`AI quarantine triggered - Risk score: ${aiResult.risk_score}%`);
          const quarantineReason = `AI threat detection: ${aiResult.risk_score}% risk (threshold: ${quarantineSettings.risk_threshold}%)`;
          await quarantineEmail(email, supabase, quarantineReason);
          
          await logWorkflowExecution(email, null, [{ type: 'quarantine', parameters: { reason: quarantineReason, ai_analysis: aiResult } }], startTime, supabase);
          return createResponse(true, emailId, analysis, [{ type: 'quarantine', parameters: { reason: quarantineReason } }], null, startTime);
        }
      } else {
        // Standard AI classification
        const classifierResponse = await supabase.functions.invoke('ai-email-classifier', {
          body: { 
            emailData: {
              subject: email.subject,
              body: email.body_content || '',
              sender_email: email.sender_email,
              sender_name: email.sender_name,
              user_id: email.user_id || null,
              mailbox_id: email.mailbox_id
            }
          }
        });

        if (classifierResponse.error) {
          console.error('AI classifier error:', classifierResponse.error);
          analysis = analyzeEmail(email);
        } else {
          const aiResult = classifierResponse.data;
          analysis = {
            risk_score: aiResult.classification.confidence < 0.7 ? 0.3 : 0.1,
            category: aiResult.classification.category,
            confidence: aiResult.classification.confidence,
            analysis_details: {
              suspicious_patterns: [],
              risk_factors: [{
                factor: 'ai_classification',
                score: aiResult.classification.confidence,
                description: aiResult.classification.reasoning
              }],
              category_indicators: [aiResult.classification.reasoning]
            }
          };
        }
      }
    } catch (error) {
      console.error('Error in AI analysis:', error);
      analysis = analyzeEmail(email);
    }
    
    console.log('Email analysis completed:', analysis);

    // Step 5: Get applicable workflow rules
    const { data: rules, error: rulesError } = await supabase
      .from('workflow_rules')
      .select('*')
      .or(`mailbox_id.eq.${email.mailbox_id},mailbox_id.is.null`)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (rulesError) {
      console.error('Error fetching workflow rules:', rulesError);
      throw new Error('Failed to fetch workflow rules');
    }

    console.log(`Found ${rules?.length || 0} workflow rules to evaluate`);

    // Step 6: Evaluate rules and determine actions
    const actionsToExecute: WorkflowAction[] = [];
    let matchedRule: WorkflowRule | null = null;

    for (const rule of rules || []) {
      console.log(`Evaluating rule: ${rule.name} with conditions:`, rule.conditions);
      console.log(`DEBUG: About to evaluate rule "${rule.name}" for email: "${email.subject}"`);
      console.log(`DEBUG: Rule actions before evaluation:`, JSON.stringify(rule.actions));
      
      if (await evaluateRule(rule, email, analysis, supabase)) {
        console.log(`✅ Rule matched: ${rule.name}`);
        console.log(`DEBUG: Rule "${rule.name}" MATCHED - adding actions:`, JSON.stringify(rule.actions));
        
        // Ensure rule.actions exists and is an array before spreading
        if (rule.actions && Array.isArray(rule.actions)) {
          console.log(`DEBUG: Adding ${rule.actions.length} actions to execution queue`);
          actionsToExecute.push(...rule.actions);
          console.log(`DEBUG: Actions queue now has ${actionsToExecute.length} actions:`, JSON.stringify(actionsToExecute));
        } else {
          console.error(`DEBUG: Rule "${rule.name}" has invalid actions:`, rule.actions);
        }
        
        matchedRule = rule;
        console.log(`DEBUG: Rule "${rule.name}" MATCHED - breaking loop`);
        break; // Execute first matching rule only
      } else {
        console.log(`❌ Rule did not match: ${rule.name}`);
        console.log(`DEBUG: Rule "${rule.name}" did NOT match`);
      }
    }

    // Step 7: Execute actions
    console.log(`DEBUG: About to execute ${actionsToExecute.length} actions:`, JSON.stringify(actionsToExecute));
    const executedActions: WorkflowAction[] = [];
    
    for (const action of actionsToExecute) {
      try {
        console.log(`DEBUG: Executing action:`, JSON.stringify(action));
        await executeAction(action, email, supabase);
        executedActions.push(action);
        console.log(`✅ Action executed successfully: ${action.type}`);
      } catch (error) {
        console.error(`❌ Error executing action ${action.type}:`, error);
        // Continue with other actions even if one fails
      }
    }
    
    console.log(`DEBUG: Execution complete. ${executedActions.length} actions executed successfully.`);

    // Step 8: Update email status and log execution
    await supabase
      .from('emails')
      .update({
        processing_status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', email.id);

    await logWorkflowExecution(email, matchedRule, executedActions, startTime, supabase);

    console.log(`Email workflow processing completed for ${emailId}`);

    return createResponse(true, emailId, analysis, executedActions, matchedRule, startTime);

  } catch (error) {
    console.error('Error in email workflow processor:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function analyzeEmail(email: any): EmailAnalysis {
  const content = `${email.subject} ${email.body_preview || ''} ${email.sender_name || ''}`.toLowerCase();
  const riskFactors: Array<{ factor: string; score: number; description: string }> = [];
  const suspiciousPatterns: string[] = [];
  const categoryIndicators: string[] = [];
  
  let riskScore = 0;
  
  // Risk analysis patterns
  const riskPatterns = [
    { pattern: /urgent|immediate|asap|emergency/i, score: 15, description: 'Urgency pressure tactics' },
    { pattern: /click here|download now|act now/i, score: 20, description: 'Suspicious call-to-action' },
    { pattern: /verify account|confirm identity|update payment/i, score: 25, description: 'Account verification phishing' },
    { pattern: /winner|congratulations|lottery|prize/i, score: 20, description: 'Prize/lottery scam indicators' },
    { pattern: /bitcoin|crypto|investment opportunity/i, score: 15, description: 'Financial scam indicators' },
    { pattern: /suspended|expired|will be closed/i, score: 20, description: 'Account threat tactics' },
    { pattern: /irs|tax refund|government/i, score: 25, description: 'Government impersonation' }
  ];
  
  for (const { pattern, score, description } of riskPatterns) {
    if (pattern.test(content)) {
      riskScore += score;
      riskFactors.push({ factor: pattern.source, score, description });
      suspiciousPatterns.push(pattern.source);
    }
  }
  
  // External domain check
  if (email.sender_email && !isInternalDomain(email.sender_email)) {
    riskScore += 5;
    riskFactors.push({ factor: 'external_sender', score: 5, description: 'Email from external domain' });
  }
  
  // Attachment check
  if (email.has_attachments) {
    riskScore += 10;
    riskFactors.push({ factor: 'has_attachments', score: 10, description: 'Email contains attachments' });
  }
  
  // Category analysis
  const categoryPatterns = {
    finance: /invoice|payment|billing|financial|bank|card|transaction|expense/i,
    security: /password|security|login|authentication|access|breach/i,
    newsletter: /newsletter|unsubscribe|marketing|promotion|offer/i,
    support: /support|help|assistance|ticket|issue/i,
    internal: /meeting|schedule|calendar|memo|announcement/i,
    spam: /spam|junk|unsolicited|bulk/i
  };
  
  let category = 'general';
  let maxConfidence = 0;
  
  for (const [cat, pattern] of Object.entries(categoryPatterns)) {
    const matches = content.match(pattern);
    if (matches) {
      const confidence = matches.length / content.split(' ').length;
      if (confidence > maxConfidence) {
        maxConfidence = confidence;
        category = cat;
        categoryIndicators.push(pattern.source);
      }
    }
  }
  
  // Ensure risk score doesn't exceed 100
  riskScore = Math.min(riskScore, 100);
  
  return {
    risk_score: riskScore,
    category,
    confidence: Math.min(maxConfidence * 100, 100),
    analysis_details: {
      suspicious_patterns: suspiciousPatterns,
      risk_factors: riskFactors,
      category_indicators: categoryIndicators
    }
  };
}

async function evaluateRule(rule: WorkflowRule, email: any, analysis: EmailAnalysis, supabase: any): Promise<boolean> {
  for (const condition of rule.conditions) {
    if (!(await evaluateCondition(condition, email, analysis, supabase))) {
      return false; // All conditions must match
    }
  }
  return true;
}

async function evaluateCondition(condition: WorkflowCondition, email: any, analysis: EmailAnalysis, supabase: any): Promise<boolean> {
  console.log(`DEBUG: Evaluating condition - field: ${condition.field}, operator: ${condition.operator}, value: ${condition.value}`);
  
  // Handle AI-based conditions
  if (condition.field === 'ai_analysis' && condition.operator === 'ai_condition') {
    console.log(`DEBUG: This is an AI condition, calling evaluateAICondition with: "${condition.value}"`);
    const aiResult = await evaluateAICondition(condition.value as string, email, supabase);
    console.log(`DEBUG: AI condition result: ${aiResult}`);
    return aiResult;
  }

  let fieldValue: any;
  
  switch (condition.field) {
    case 'subject':
      fieldValue = email.subject;
      break;
    case 'sender_email':
      fieldValue = email.sender_email;
      break;
    case 'body_content':
      fieldValue = email.body_content || email.body_preview || '';
      break;
    case 'has_attachments':
      fieldValue = email.has_attachments;
      break;
    case 'risk_score':
      fieldValue = analysis.risk_score;
      break;
    case 'category':
      fieldValue = analysis.category;
      break;
    default:
      return false;
  }
  
  const targetValue = condition.value;
  
  // Handle string comparisons
  if (typeof fieldValue === 'string' && typeof targetValue === 'string') {
    const field = condition.case_sensitive ? fieldValue : fieldValue.toLowerCase();
    const target = condition.case_sensitive ? targetValue : targetValue.toLowerCase();
    
    switch (condition.operator) {
      case 'contains':
        return field.includes(target);
      case 'equals':
        return field === target;
      case 'not_equals':
        return field !== target;
      case 'starts_with':
        return field.startsWith(target);
      case 'ends_with':
        return field.endsWith(target);
      default:
        return false;
    }
  }
  
  // Handle numeric comparisons
  if (typeof fieldValue === 'number' && typeof targetValue === 'number') {
    switch (condition.operator) {
      case 'equals':
        return fieldValue === targetValue;
      case 'not_equals':
        return fieldValue !== targetValue;
      case 'greater_than':
        return fieldValue > targetValue;
      case 'less_than':
        return fieldValue < targetValue;
      default:
        return false;
    }
  }
  
  // Handle boolean comparisons
  if (typeof fieldValue === 'boolean' && typeof targetValue === 'boolean') {
    return condition.operator === 'equals' ? fieldValue === targetValue : fieldValue !== targetValue;
  }
  
  return false;
}

// New function to evaluate AI-based conditions
async function evaluateAICondition(condition: string, email: any, supabase: any): Promise<boolean> {
  try {
    console.log(`Evaluating AI condition: "${condition}" for email: ${email.subject}`);
    
    const response = await supabase.functions.invoke('ai-condition-evaluator', {
      body: {
        condition: condition,
        email: {
          id: email.id,
          subject: email.subject,
          sender_email: email.sender_email,
          sender_name: email.sender_name,
          body_content: email.body_content,
          body_preview: email.body_preview,
          importance: email.importance,
          received_at: email.received_at
        }
      }
    });

    // Log the full response for debugging
    console.log('AI condition evaluator raw response:', JSON.stringify(response, null, 2));

    if (response.error) {
      console.error('Error calling AI condition evaluator:', response.error);
      return false;
    }

    const result = response.data;
    if (result?.success && result?.result) {
      console.log(`AI evaluation result: ${result.result.meets_condition} (confidence: ${result.result.confidence})`);
      console.log(`Reasoning: ${result.result.reasoning}`);
      
      // Debug: Log the detailed AI response for troubleshooting
      console.log(`DEBUG AI Response: meets_condition=${result.result.meets_condition}, confidence=${result.result.confidence}, threshold=0.5`);
      
      const meetsCriteria = result.result.meets_condition && result.result.confidence > 0.5;
      console.log(`DEBUG: Rule evaluation result: ${meetsCriteria} (meets_condition: ${result.result.meets_condition}, confidence > 0.5: ${result.result.confidence > 0.5})`);
      
      // Use lower confidence threshold for better matching - reduced from 0.7 to 0.5
      return meetsCriteria;
    } else if (result?.fallback_result) {
      // Handle fallback case when AI is unavailable
      console.log(`AI evaluation fallback: ${result.fallback_result.meets_condition} (${result.fallback_result.reasoning})`);
      return result.fallback_result.meets_condition;
    }

    console.error('Unexpected AI condition evaluator response format:', result);
    return false;
  } catch (error) {
    console.error('Error evaluating AI condition:', error);
    return false;
  }
}

async function executeAction(action: WorkflowAction, email: any, supabase: any): Promise<void> {
  switch (action.type) {
    case 'categorize':
    case 'categorise': // Handle British spelling
      await categorizeEmail(email, action.parameters.category_id, supabase);
      break;
      
    case 'quarantine':
      await quarantineEmail(email, supabase);
      break;
      
    case 'mark_as_read':
      await markEmailAsRead(email, supabase);
      break;
      
    case 'send_notification':
      await sendNotification(email, action.parameters, supabase);
      break;
      
    default:
      console.warn(`Unknown action type: ${action.type}`);
  }
}

async function categorizeEmail(email: any, categoryId: string, supabase: any): Promise<void> {
  console.log(`DEBUG: Categorizing email ${email.id} with category ${categoryId}`);
  console.log(`DEBUG: Email details - tenant_id: ${email.tenant_id}, mailbox_id: ${email.mailbox_id}`);
  
  // Insert or update the email classification
  const { data, error } = await supabase
    .from('email_classifications')
    .upsert({
      tenant_id: email.tenant_id,
      email_id: email.id,
      mailbox_id: email.mailbox_id,
      category_id: categoryId,
      classification_method: 'rule',
      confidence_score: 1.0
    });

  if (error) {
    console.error('❌ Error categorizing email:', error);
    console.error('❌ Failed upsert data:', { tenant_id: email.tenant_id, email_id: email.id, mailbox_id: email.mailbox_id, category_id: categoryId });
    throw error;
  }

  console.log('✅ Email categorized successfully:', data);

  // Apply category to email in Microsoft 365
  try {
    await applyCategoryToEmailInM365(email, categoryId, supabase);
  } catch (m365Error) {
    console.error('❌ Error applying category to email in M365:', m365Error);
    // Don't throw here - classification in our DB succeeded, M365 sync is secondary
  }

  // Log categorization activity
  await supabase
    .from('audit_logs')
    .insert({
      tenant_id: email.tenant_id,
      mailbox_id: email.mailbox_id,
      action: 'email_categorized',
      details: {
        email_id: email.id,
        subject: email.subject,
        category_id: categoryId,
        method: 'workflow_rule'
      }
    });
}

async function applyCategoryToEmailInM365(email: any, categoryId: string, supabase: any): Promise<void> {
  console.log(`🔄 Applying category to email ${email.id} in Microsoft 365`);
  
  // Get category name
  const { data: category, error: categoryError } = await supabase
    .from('email_categories')
    .select('name')
    .eq('id', categoryId)
    .maybeSingle();

  if (categoryError || !category) {
    console.error('❌ Category not found:', categoryError);
    throw new Error('Category not found');
  }

  // Get mailbox with Microsoft Graph token
  const { data: mailbox, error: mailboxError } = await supabase
    .from('mailboxes')
    .select('microsoft_graph_token')
    .eq('id', email.mailbox_id)
    .maybeSingle();

  if (mailboxError || !mailbox || !mailbox.microsoft_graph_token) {
    console.error('❌ Mailbox or token not found:', mailboxError);
    throw new Error('Mailbox not connected to Microsoft Graph');
  }

  // Parse the token
  let parsedToken;
  try {
    parsedToken = JSON.parse(mailbox.microsoft_graph_token);
  } catch (error) {
    console.error('❌ Failed to parse Microsoft Graph token:', error);
    throw new Error('Invalid Microsoft Graph token format');
  }

  // Check if token is expired and refresh if needed
  const now = Date.now();
  if (parsedToken.expires_at && parsedToken.expires_at <= now) {
    console.log('🔄 Token expired, attempting to refresh...');
    
    if (!parsedToken.refresh_token) {
      console.error('❌ No refresh token available');
      throw new Error('No refresh token available');
    }

    parsedToken = await refreshTokenForM365Category(parsedToken, email.mailbox_id, supabase);
    console.log('✅ Token refreshed successfully');
  }

  // Apply category to email in M365
  const updateUrl = `https://graph.microsoft.com/v1.0/me/messages/${email.microsoft_id}`;
  
  const updateData = {
    categories: [category.name]
  };

  console.log(`🔄 Updating email ${email.microsoft_id} with category: ${category.name}`);
  
  const updateResponse = await fetch(updateUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${parsedToken.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    console.error(`❌ Failed to apply category to email: ${updateResponse.status} - ${errorText}`);
    throw new Error(`Failed to apply category to email: ${updateResponse.status} - ${errorText}`);
  }

  console.log(`✅ Successfully applied category "${category.name}" to email ${email.microsoft_id} in M365`);
}

async function refreshTokenForM365Category(tokenData: any, mailboxId: string, supabase: any): Promise<any> {
  const refreshUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  
  const params = new URLSearchParams({
    client_id: '80b5126b-2f86-4a4d-8d55-43afbd7c970e',
    client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET') ?? '',
    scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/MailboxSettings.ReadWrite offline_access',
    refresh_token: tokenData.refresh_token,
    grant_type: 'refresh_token'
  });

  const response = await fetch(refreshUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  const newTokenData = await response.json();
  
  const expiresAt = Date.now() + (newTokenData.expires_in * 1000);
  const updatedTokenData = {
    access_token: newTokenData.access_token,
    refresh_token: newTokenData.refresh_token || tokenData.refresh_token,
    expires_at: expiresAt
  };

  await supabase
    .from('mailboxes')
    .update({ microsoft_graph_token: JSON.stringify(updatedTokenData) })
    .eq('id', mailboxId);

  console.log('✅ Token refreshed successfully for M365 category application');
  return updatedTokenData;
}

async function quarantineEmail(email: any, supabase: any, reason?: string): Promise<void> {
  await supabase
    .from('emails')
    .update({
      processing_status: 'quarantined',
      processed_at: new Date().toISOString()
    })
    .eq('id', email.id);

  // Log quarantine activity
  await supabase
    .from('audit_logs')
    .insert({
      tenant_id: email.tenant_id,
      mailbox_id: email.mailbox_id,
      action: 'email_quarantined',
      details: {
        email_id: email.id,
        subject: email.subject,
        sender: email.sender_email,
        reason: reason || 'workflow_rule_triggered',
        quarantined_at: new Date().toISOString()
      }
    });
}

async function markEmailAsRead(email: any, supabase: any): Promise<void> {
  await supabase
    .from('emails')
    .update({ is_read: true })
    .eq('id', email.id);
}

async function sendNotification(email: any, parameters: any, supabase: any): Promise<void> {
  // Log notification (could be extended to actual email/SMS sending)
  await supabase
    .from('audit_logs')
    .insert({
      tenant_id: email.tenant_id,
      mailbox_id: email.mailbox_id,
      action: 'notification_sent',
      details: {
        email_id: email.id,
        notification_type: parameters.type,
        recipient: parameters.recipient,
        message: parameters.message
      }
    });
}

function isInternalDomain(email: string): boolean {
  // Define your internal domains here
  const internalDomains = ['company.com', 'organization.org'];
  const domain = email.split('@')[1]?.toLowerCase();
  return internalDomains.includes(domain);
}

// New helper functions for enhanced quarantine system

async function checkPreQuarantineRules(email: any, settings: any): Promise<{shouldQuarantine: boolean, reason?: string}> {
  const content = `${email.subject} ${email.body_content || email.body_preview || ''}`.toLowerCase();
  const senderDomain = email.sender_email.split('@')[1]?.toLowerCase();
  
  // Check whitelist first
  if (settings.whitelist_domains?.length > 0) {
    for (const domain of settings.whitelist_domains) {
      if (senderDomain === domain.toLowerCase().trim()) {
        console.log(`Email from whitelisted domain: ${senderDomain}`);
        return { shouldQuarantine: false };
      }
    }
  }
  
  // Check auto-quarantine keywords
  if (settings.auto_quarantine_keywords?.length > 0) {
    for (const keyword of settings.auto_quarantine_keywords) {
      if (content.includes(keyword.toLowerCase().trim())) {
        return { 
          shouldQuarantine: true, 
          reason: `Auto-quarantine keyword detected: "${keyword}"` 
        };
      }
    }
  }
  
  // Check suspicious patterns
  if (settings.suspicious_patterns?.length > 0) {
    let suspiciousCount = 0;
    const foundPatterns: string[] = [];
    
    for (const pattern of settings.suspicious_patterns) {
      if (content.includes(pattern.toLowerCase().trim())) {
        suspiciousCount++;
        foundPatterns.push(pattern);
      }
    }
    
    // Quarantine if multiple suspicious patterns found
    if (suspiciousCount >= 2) {
      return { 
        shouldQuarantine: true, 
        reason: `Multiple suspicious patterns detected: ${foundPatterns.join(', ')}` 
      };
    }
  }
  
  return { shouldQuarantine: false };
}

async function performAIThreatAnalysis(email: any, settings: any, supabase: any): Promise<EmailAnalysis> {
  try {
    // Get OpenAI settings
    const { data: openaiConfig } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'openai_config')
      .maybeSingle();

    if (!openaiConfig?.value?.api_key) {
      console.log('No OpenAI API key configured, falling back to basic analysis');
      return analyzeEmail(email);
    }

    const apiKey = openaiConfig.value.api_key;
    let model = openaiConfig.value.model || 'gpt-4o-mini';
    
    // Fix model name compatibility - remove date suffixes  
    if (model.includes('-2025-')) {
      model = model.split('-2025-')[0];
    }

    // Get custom AI prompts if configured
    let threatAnalysisPrompt = `You are a cybersecurity expert analyzing emails for threats. Analyze this email and provide a detailed threat assessment.

Email Details:
Subject: {subject}
Sender: {sender_email}
Content: {content}
Has Attachments: {has_attachments}

Analyze for:
1. Phishing attempts
2. Social engineering tactics
3. Malware indicators
4. Suspicious URLs or attachments
5. Business email compromise (BEC)
6. Urgency tactics and pressure techniques
7. Impersonation attempts

Provide your response as JSON with:
{
  "risk_score": number (0-100),
  "threat_level": "low" | "medium" | "high" | "critical",
  "threat_types": ["phishing", "malware", "bec", "social_engineering"],
  "confidence": number (0-1),
  "reasoning": "detailed explanation",
  "suspicious_indicators": ["list of specific indicators found"],
  "recommended_action": "allow" | "flag" | "quarantine"
}`;

    const { data: aiPromptsConfig, error: promptsError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_prompts')
      .maybeSingle();

    if (!promptsError && aiPromptsConfig?.value?.threat_analysis_prompt) {
      threatAnalysisPrompt = aiPromptsConfig.value.threat_analysis_prompt;
      console.log('Using custom threat analysis prompt');
    }

    // Replace placeholders in the prompt
    const finalPrompt = threatAnalysisPrompt
      .replace('{subject}', email.subject)
      .replace('{sender_email}', email.sender_email)
      .replace('{content}', email.body_content || email.body_preview || 'No content available')
      .replace('{has_attachments}', email.has_attachments ? 'Yes' : 'No');

    // Call OpenAI API for threat analysis
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: 'You are a cybersecurity expert. Respond only with valid JSON.' },
          { role: 'user', content: finalPrompt }
        ],
        ...(model.startsWith('gpt-4.1') || model.startsWith('gpt-5') || model.startsWith('o3') || model.startsWith('o4') 
            ? { max_completion_tokens: 1000 } 
            : { max_tokens: 1000 }),
        ...(model.startsWith('gpt-4.1') || model.startsWith('gpt-5') || model.startsWith('o3') || model.startsWith('o4') 
            ? {} 
            : { temperature: 0.3 }),
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return analyzeEmail(email);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices[0].message.content;

    console.log('AI threat analysis result:', content);

    // Parse AI response
    let aiAnalysis;
    try {
      aiAnalysis = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return analyzeEmail(email);
    }

    // Convert to our analysis format
    return {
      risk_score: aiAnalysis.risk_score || 0,
      category: 'threat_analysis',
      confidence: aiAnalysis.confidence || 0.5,
      analysis_details: {
        suspicious_patterns: aiAnalysis.suspicious_indicators || [],
        risk_factors: [{
          factor: 'ai_threat_analysis',
          score: aiAnalysis.risk_score || 0,
          description: aiAnalysis.reasoning || 'AI threat analysis completed'
        }],
        category_indicators: aiAnalysis.threat_types || []
      }
    };

  } catch (error) {
    console.error('Error in AI threat analysis:', error);
    return analyzeEmail(email);
  }
}

async function logWorkflowExecution(email: any, rule: any, actions: any[], startTime: number, supabase: any): Promise<void> {
  await supabase
    .from('workflow_executions')
    .insert({
      tenant_id: email.tenant_id,
      email_id: email.id,
      mailbox_id: email.mailbox_id,
      rule_id: rule?.id,
      execution_status: actions.length > 0 ? 'completed' : 'completed', // Use 'completed' even for no actions
      actions_taken: actions,
      execution_time_ms: Date.now() - startTime
    });

  // Log detailed workflow execution
  await supabase
    .from('audit_logs')
    .insert({
      tenant_id: email.tenant_id,
      mailbox_id: email.mailbox_id,
      action: 'workflow_executed',
      details: {
        email_id: email.id,
        subject: email.subject,
        sender: email.sender_email,
        matched_rule: rule?.name || 'No rule matched',
        rule_id: rule?.id,
        actions_executed: actions.map(a => ({ type: a.type, parameters: a.parameters })),
        actions_count: actions.length,
        execution_time_ms: Date.now() - startTime,
        status: actions.length > 0 ? 'actions_executed' : 'no_actions_taken'
      }
    });
}

function createResponse(success: boolean, emailId: string, analysis: any, actions: any[], rule: any, startTime: number) {
  return new Response(JSON.stringify({
    success,
    email_id: emailId,
    analysis,
    actions_executed: actions,
    matched_rule: rule?.name,
    execution_time_ms: Date.now() - startTime
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}