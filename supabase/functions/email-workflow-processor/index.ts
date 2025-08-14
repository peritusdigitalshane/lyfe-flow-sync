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
  field: 'subject' | 'sender_email' | 'body_content' | 'has_attachments' | 'risk_score' | 'category';
  operator: 'contains' | 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'starts_with' | 'ends_with';
  value: string | number | boolean;
  case_sensitive?: boolean;
}

interface WorkflowAction {
  type: 'categorize' | 'quarantine' | 'move_to_folder' | 'mark_as_read' | 'send_notification' | 'delete' | 'forward';
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

    // Step 1: Analyze email
    const analysis = analyzeEmail(email);
    console.log('Email analysis completed:', analysis);

    // Step 2: Get applicable workflow rules
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

    // Step 3: Evaluate rules and determine actions
    const actionsToExecute: WorkflowAction[] = [];
    let matchedRule: WorkflowRule | null = null;

    for (const rule of rules || []) {
      if (evaluateRule(rule, email, analysis)) {
        actionsToExecute.push(...rule.actions);
        matchedRule = rule;
        console.log(`Rule matched: ${rule.name}`);
        break; // Execute first matching rule only
      }
    }

    // Step 4: Execute actions
    const executedActions: WorkflowAction[] = [];
    
    for (const action of actionsToExecute) {
      try {
        await executeAction(action, email, supabase);
        executedActions.push(action);
        console.log(`Action executed: ${action.type}`);
      } catch (error) {
        console.error(`Error executing action ${action.type}:`, error);
        // Continue with other actions even if one fails
      }
    }

    // Step 5: Update email status
    await supabase
      .from('emails')
      .update({
        processing_status: 'processed',
        processed_at: new Date().toISOString()
      })
      .eq('id', email.id);

    // Step 6: Log execution
    await supabase
      .from('workflow_executions')
      .insert({
        tenant_id: email.tenant_id,
        email_id: email.id,
        mailbox_id: email.mailbox_id,
        rule_id: matchedRule?.id,
        execution_status: 'completed',
        actions_taken: executedActions,
        execution_time_ms: Date.now() - startTime
      });

    console.log(`Email workflow processing completed for ${emailId}`);

    return new Response(JSON.stringify({
      success: true,
      email_id: emailId,
      analysis,
      actions_executed: executedActions,
      matched_rule: matchedRule?.name,
      execution_time_ms: Date.now() - startTime
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

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

function evaluateRule(rule: WorkflowRule, email: any, analysis: EmailAnalysis): boolean {
  for (const condition of rule.conditions) {
    if (!evaluateCondition(condition, email, analysis)) {
      return false; // All conditions must match
    }
  }
  return true;
}

function evaluateCondition(condition: WorkflowCondition, email: any, analysis: EmailAnalysis): boolean {
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

async function executeAction(action: WorkflowAction, email: any, supabase: any): Promise<void> {
  switch (action.type) {
    case 'categorize':
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
  await supabase
    .from('email_classifications')
    .upsert({
      tenant_id: email.tenant_id,
      email_id: email.id,
      mailbox_id: email.mailbox_id,
      category_id: categoryId,
      classification_method: 'workflow_rule',
      confidence_score: 1.0
    });
}

async function quarantineEmail(email: any, supabase: any): Promise<void> {
  await supabase
    .from('emails')
    .update({
      processing_status: 'quarantined',
      processed_at: new Date().toISOString()
    })
    .eq('id', email.id);
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