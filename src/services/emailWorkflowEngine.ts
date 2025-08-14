import { supabase } from "@/integrations/supabase/client";
import { Email } from "./emailPollingService";

export interface WorkflowRule {
  id: string;
  name: string;
  tenant_id: string;
  mailbox_id?: string | null;
  description?: string | null;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowCondition {
  field: 'subject' | 'sender_email' | 'body_content' | 'has_attachments' | 'risk_score' | 'category';
  operator: 'contains' | 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'starts_with' | 'ends_with';
  value: string | number | boolean;
  case_sensitive?: boolean;
}

export interface WorkflowAction {
  type: 'categorize' | 'quarantine' | 'move_to_folder' | 'mark_as_read' | 'send_notification' | 'delete' | 'forward';
  parameters: Record<string, any>;
}

export interface WorkflowExecution {
  id: string;
  tenant_id: string;
  email_id: string;
  mailbox_id: string;
  rule_id?: string;
  execution_status: 'pending' | 'completed' | 'failed';
  actions_taken: WorkflowAction[];
  error_message?: string;
  execution_time_ms: number;
  created_at: string;
}

export interface EmailAnalysis {
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

class EmailWorkflowEngine {
  /**
   * Process a single email through the workflow system
   */
  async processEmail(email: Email): Promise<{
    success: boolean;
    analysis: EmailAnalysis;
    actionsExecuted: WorkflowAction[];
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      // Step 1: Analyze email for risk and category
      const analysis = await this.analyzeEmail(email);
      
      // Step 2: Get applicable workflow rules
      const rules = await this.getApplicableRules(email.mailbox_id);
      
      // Step 3: Evaluate rules and determine actions
      const actionsToExecute: WorkflowAction[] = [];
      let matchedRule: WorkflowRule | null = null;
      
      for (const rule of rules) {
        if (await this.evaluateRule(rule, email, analysis)) {
          actionsToExecute.push(...rule.actions);
          matchedRule = rule;
          break; // Execute first matching rule only
        }
      }
      
      // Step 4: Execute actions
      const executedActions = await this.executeActions(actionsToExecute, email);
      
      // Step 5: Log execution
      await this.logExecution({
        tenant_id: email.tenant_id,
        email_id: email.id,
        mailbox_id: email.mailbox_id,
        rule_id: matchedRule?.id,
        execution_status: 'completed',
        actions_taken: executedActions,
        execution_time_ms: Date.now() - startTime
      });
      
      return {
        success: true,
        analysis,
        actionsExecuted: executedActions
      };
      
    } catch (error) {
      console.error('Error processing email:', error);
      
      // Log failed execution
      await this.logExecution({
        tenant_id: email.tenant_id,
        email_id: email.id,
        mailbox_id: email.mailbox_id,
        execution_status: 'failed',
        actions_taken: [],
        execution_time_ms: Date.now() - startTime,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        analysis: this.getDefaultAnalysis(),
        actionsExecuted: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Analyze email content for risk scoring and categorization
   */
  private async analyzeEmail(email: Email): Promise<EmailAnalysis> {
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
    if (email.sender_email && !this.isInternalDomain(email.sender_email)) {
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
  
  /**
   * Get workflow rules applicable to a mailbox
   */
  private async getApplicableRules(mailboxId: string): Promise<WorkflowRule[]> {
    const { data, error } = await supabase
      .from('workflow_rules')
      .select('*')
      .or(`mailbox_id.eq.${mailboxId},mailbox_id.is.null`)
      .eq('is_active', true)
      .order('priority', { ascending: false });
    
    if (error) {
      console.error('Error fetching workflow rules:', error);
      return [];
    }
    
    // Convert JSON fields to proper types
    return (data || []).map(rule => ({
      ...rule,
      conditions: Array.isArray(rule.conditions) ? rule.conditions as unknown as WorkflowCondition[] : [],
      actions: Array.isArray(rule.actions) ? rule.actions as unknown as WorkflowAction[] : []
    } as WorkflowRule));
  }
  
  /**
   * Evaluate if a rule matches the given email and analysis
   */
  private async evaluateRule(rule: WorkflowRule, email: Email, analysis: EmailAnalysis): Promise<boolean> {
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, email, analysis)) {
        return false; // All conditions must match
      }
    }
    return true;
  }
  
  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: WorkflowCondition, email: Email, analysis: EmailAnalysis): boolean {
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
  
  /**
   * Execute workflow actions
   */
  private async executeActions(actions: WorkflowAction[], email: Email): Promise<WorkflowAction[]> {
    const executedActions: WorkflowAction[] = [];
    
    for (const action of actions) {
      try {
        await this.executeAction(action, email);
        executedActions.push(action);
      } catch (error) {
        console.error(`Error executing action ${action.type}:`, error);
        // Continue with other actions even if one fails
      }
    }
    
    return executedActions;
  }
  
  /**
   * Execute a single action
   */
  private async executeAction(action: WorkflowAction, email: Email): Promise<void> {
    switch (action.type) {
      case 'categorize':
        await this.categorizeEmail(email, action.parameters.category_id);
        break;
        
      case 'quarantine':
        await this.quarantineEmail(email);
        break;
        
      case 'mark_as_read':
        await this.markEmailAsRead(email);
        break;
        
      case 'send_notification':
        await this.sendNotification(email, action.parameters);
        break;
        
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }
  
  /**
   * Categorize an email
   */
  private async categorizeEmail(email: Email, categoryId: string): Promise<void> {
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
  
  /**
   * Quarantine an email (mark as high risk)
   */
  private async quarantineEmail(email: Email): Promise<void> {
    await supabase
      .from('emails')
      .update({
        processing_status: 'quarantined',
        processed_at: new Date().toISOString()
      })
      .eq('id', email.id);
  }
  
  /**
   * Mark email as read
   */
  private async markEmailAsRead(email: Email): Promise<void> {
    await supabase
      .from('emails')
      .update({ is_read: true })
      .eq('id', email.id);
  }
  
  /**
   * Send notification
   */
  private async sendNotification(email: Email, parameters: any): Promise<void> {
    // Log notification (could be extended to actual email/SMS sending)
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: email.tenant_id,
        mailbox_id: email.mailbox_id,
        action: 'config_updated', // Use existing enum value
        details: {
          action_type: 'notification_sent',
          email_id: email.id,
          notification_type: parameters.type,
          recipient: parameters.recipient,
          message: parameters.message
        }
      });
  }
  
  /**
   * Log workflow execution
   */
  private async logExecution(execution: Omit<WorkflowExecution, 'id' | 'created_at'>): Promise<void> {
    await supabase
      .from('workflow_executions')
      .insert({
        tenant_id: execution.tenant_id,
        email_id: execution.email_id,
        mailbox_id: execution.mailbox_id,
        rule_id: execution.rule_id,
        execution_status: execution.execution_status,
        actions_taken: execution.actions_taken as any, // Convert to JSON
        error_message: execution.error_message,
        execution_time_ms: execution.execution_time_ms
      });
  }
  
  /**
   * Helper methods
   */
  private isInternalDomain(email: string): boolean {
    // Define your internal domains here
    const internalDomains = ['company.com', 'organization.org'];
    const domain = email.split('@')[1]?.toLowerCase();
    return internalDomains.includes(domain);
  }
  
  private getDefaultAnalysis(): EmailAnalysis {
    return {
      risk_score: 0,
      category: 'general',
      confidence: 0,
      analysis_details: {
        suspicious_patterns: [],
        risk_factors: [],
        category_indicators: []
      }
    };
  }
  
  /**
   * Process multiple emails in batch
   */
  async processEmailBatch(emails: Email[]): Promise<{
    processed: number;
    failed: number;
    results: Array<{
      email_id: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    const results = [];
    let processed = 0;
    let failed = 0;
    
    for (const email of emails) {
      const result = await this.processEmail(email);
      
      if (result.success) {
        processed++;
      } else {
        failed++;
      }
      
      results.push({
        email_id: email.id,
        success: result.success,
        error: result.error
      });
    }
    
    return { processed, failed, results };
  }
}

export const emailWorkflowEngine = new EmailWorkflowEngine();