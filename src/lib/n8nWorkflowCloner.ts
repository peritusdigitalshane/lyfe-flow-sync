import { supabase } from '@/integrations/supabase/client';

export interface WorkflowTemplate {
  name: string;
  nodes: any[];
  connections: Record<string, any>;
  tags: string[];
}

export interface CloneWorkflowParams {
  mailboxId: string;
  emailAddress: string;
  displayName: string;
  tenantId: string;
  microsoftGraphToken: any;
}

// Master workflow template that will be cloned for each mailbox
const MASTER_WORKFLOW_TEMPLATE: WorkflowTemplate = {
  name: "Email Security Monitor Template",
  tags: ["email", "security", "template"],
  nodes: [
    {
      id: "trigger",
      name: "Email Trigger",
      type: "@n8n/n8n-nodes-microsoft.MicrosoftGraphMail",
      typeVersion: 1,
      position: [250, 300],
      parameters: {
        operation: "getAll",
        resource: "message"
      }
    },
    {
      id: "analyzer",
      name: "Email Analyzer",
      type: "@n8n/n8n-nodes-base.Code",
      typeVersion: 1,
      position: [450, 300],
      parameters: {
        jsCode: `
// Email security analysis logic
const email = items[0].json;

// Analyze email content, sender, attachments
const riskScore = analyzeEmailRisk(email);
const category = categorizeEmail(email);

return [{
  json: {
    ...email,
    risk_score: riskScore,
    category: category,
    analysis_timestamp: new Date().toISOString()
  }
}];

function analyzeEmailRisk(email) {
  let score = 0;
  
  // Check for suspicious patterns
  if (email.subject?.toLowerCase().includes('urgent')) score += 10;
  if (email.bodyPreview?.includes('click here')) score += 15;
  if (email.hasAttachments) score += 5;
  
  return Math.min(score, 100);
}

function categorizeEmail(email) {
  const content = (email.subject + ' ' + email.bodyPreview).toLowerCase();
  
  if (content.includes('invoice') || content.includes('payment')) return 'finance';
  if (content.includes('password') || content.includes('security')) return 'security';
  if (content.includes('newsletter') || content.includes('unsubscribe')) return 'newsletter';
  
  return 'general';
}
        `
      }
    },
    {
      id: "decision",
      name: "Risk Decision",
      type: "@n8n/n8n-nodes-base.If",
      typeVersion: 1,
      position: [650, 300],
      parameters: {
        conditions: {
          string: [
            {
              value1: "={{$json.risk_score}}",
              operation: "largerEqual",
              value2: "50"
            }
          ]
        }
      }
    },
    {
      id: "quarantine",
      name: "Quarantine Email",
      type: "@n8n/n8n-nodes-microsoft.MicrosoftGraphMail",
      typeVersion: 1,
      position: [850, 200],
      parameters: {
        operation: "move",
        resource: "message",
        folderId: "quarantine"
      }
    },
    {
      id: "notify",
      name: "Notify Admin",
      type: "@n8n/n8n-nodes-base.Webhook",
      typeVersion: 1,
      position: [850, 400],
      parameters: {
        httpMethod: "POST",
        responseMode: "onReceived"
      }
    },
    {
      id: "log",
      name: "Log Activity",
      type: "@n8n/n8n-nodes-base.Supabase",
      typeVersion: 1,
      position: [1050, 300],
      parameters: {
        operation: "insert",
        table: "audit_logs",
        additionalFields: {
          action: "email_processed",
          details: "={{$json}}"
        }
      }
    }
  ],
  connections: {
    "Email Trigger": {
      "main": [[{ "node": "Email Analyzer", "type": "main", "index": 0 }]]
    },
    "Email Analyzer": {
      "main": [[{ "node": "Risk Decision", "type": "main", "index": 0 }]]
    },
    "Risk Decision": {
      "main": [
        [{ "node": "Quarantine Email", "type": "main", "index": 0 }],
        [{ "node": "Notify Admin", "type": "main", "index": 0 }]
      ]
    },
    "Quarantine Email": {
      "main": [[{ "node": "Log Activity", "type": "main", "index": 0 }]]
    },
    "Notify Admin": {
      "main": [[{ "node": "Log Activity", "type": "main", "index": 0 }]]
    }
  }
};

export class N8NWorkflowCloner {
  private n8nBaseUrl: string;
  private n8nApiToken: string;

  constructor() {
    this.n8nBaseUrl = 'https://agent.lyfeai.com.au';
    this.n8nApiToken = process.env.N8N_API_TOKEN || '';
  }

  async cloneWorkflowForMailbox(params: CloneWorkflowParams): Promise<{
    workflowId: string;
    credentialId: string;
  }> {
    try {
      // 1. Create Microsoft Graph credential for this mailbox
      const credentialId = await this.createMicrosoftCredential(params);

      // 2. Clone the master workflow template
      const workflowId = await this.createWorkflowFromTemplate(params, credentialId);

      // 3. Configure the workflow with mailbox-specific settings
      await this.configureWorkflow(workflowId, credentialId, params);

      // 4. Create database records
      await this.createDatabaseRecords(params, workflowId, credentialId);

      return { workflowId, credentialId };
    } catch (error) {
      console.error('Error cloning workflow:', error);
      throw error;
    }
  }

  private async createMicrosoftCredential(params: CloneWorkflowParams): Promise<string> {
    const credentialData = {
      name: `${params.displayName} - Microsoft Graph`,
      type: 'microsoftGraphApi',
      data: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        accessToken: params.microsoftGraphToken.access_token,
        refreshToken: params.microsoftGraphToken.refresh_token,
        expiresAt: params.microsoftGraphToken.expires_at
      }
    };

    const response = await fetch(`${this.n8nBaseUrl}/api/v1/credentials`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.n8nApiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentialData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create credential: ${response.statusText}`);
    }

    const result = await response.json();
    return result.id;
  }

  private async createWorkflowFromTemplate(
    params: CloneWorkflowParams, 
    credentialId: string
  ): Promise<string> {
    // Customize the template for this specific mailbox
    const customizedTemplate = {
      ...MASTER_WORKFLOW_TEMPLATE,
      name: `${params.displayName} - Email Security Monitor`,
      tags: [...MASTER_WORKFLOW_TEMPLATE.tags, params.emailAddress, params.tenantId],
      nodes: MASTER_WORKFLOW_TEMPLATE.nodes.map(node => ({
        ...node,
        // Assign the Microsoft Graph credential to relevant nodes
        credentials: node.type.includes('MicrosoftGraph') ? {
          microsoftGraphApi: {
            id: credentialId,
            name: `${params.displayName} - Microsoft Graph`
          }
        } : node.credentials
      }))
    };

    const response = await fetch(`${this.n8nBaseUrl}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.n8nApiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(customizedTemplate)
    });

    if (!response.ok) {
      throw new Error(`Failed to create workflow: ${response.statusText}`);
    }

    const result = await response.json();
    return result.id;
  }

  private async configureWorkflow(
    workflowId: string, 
    credentialId: string, 
    params: CloneWorkflowParams
  ): Promise<void> {
    // Load current mailbox configuration
    const { data: config } = await supabase
      .from('mailbox_configs')
      .select('config')
      .eq('mailbox_id', params.mailboxId)
      .eq('is_active', true)
      .single();

    const mailboxConfig = config?.config as any || {};

    // Update workflow settings based on mailbox configuration
    const workflowSettings = {
      active: true,
      settings: {
        executionOrder: 'v1',
        saveManualExecutions: true,
        callerPolicy: 'workflowsFromSameOwner',
        errorWorkflow: '',
        timezone: 'America/New_York'
      },
      // Configure trigger frequency based on mailbox settings
      triggerData: {
        frequency: mailboxConfig.sync_frequency || 5,
        monitoredFolders: mailboxConfig.monitored_folders || ['Inbox']
      }
    };

    const response = await fetch(`${this.n8nBaseUrl}/api/v1/workflows/${workflowId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.n8nApiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(workflowSettings)
    });

    if (!response.ok) {
      throw new Error(`Failed to configure workflow: ${response.statusText}`);
    }
  }

  private async createDatabaseRecords(
    params: CloneWorkflowParams,
    workflowId: string,
    credentialId: string
  ): Promise<void> {
    // Create n8n_bindings record
    const { error: bindingError } = await supabase
      .from('n8n_bindings')
      .insert({
        mailbox_id: params.mailboxId,
        tenant_id: params.tenantId,
        n8n_workflow_id: workflowId,
        n8n_credential_id: credentialId,
        workflow_name: `${params.displayName} - Email Security Monitor`,
        is_active: true
      });

    if (bindingError) throw bindingError;

    // Update mailbox record
    const { error: mailboxError } = await supabase
      .from('mailboxes')
      .update({
        n8n_workflow_id: workflowId,
        n8n_credential_id: credentialId,
        status: 'connected'
      })
      .eq('id', params.mailboxId);

    if (mailboxError) throw mailboxError;

    // Log the activity
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        tenant_id: params.tenantId,
        mailbox_id: params.mailboxId,
        action: 'workflow_synced', // Using existing valid action
        details: {
          workflow_id: workflowId,
          credential_id: credentialId,
          email_address: params.emailAddress,
          action_type: 'workflow_cloned'
        }
      });

    if (auditError) console.error('Failed to log audit:', auditError);
  }

  async activateWorkflow(workflowId: string): Promise<void> {
    const response = await fetch(`${this.n8nBaseUrl}/api/v1/workflows/${workflowId}/activate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.n8nApiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to activate workflow: ${response.statusText}`);
    }
  }

  async deactivateWorkflow(workflowId: string): Promise<void> {
    const response = await fetch(`${this.n8nBaseUrl}/api/v1/workflows/${workflowId}/deactivate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.n8nApiToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to deactivate workflow: ${response.statusText}`);
    }
  }
}

// Export singleton instance
export const workflowCloner = new N8NWorkflowCloner();