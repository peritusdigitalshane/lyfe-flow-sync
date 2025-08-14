interface N8nCredential {
  id: string;
  name: string;
  type: string;
  data: Record<string, any>;
}

interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    parameters?: Record<string, any>;
    credentials?: Record<string, string>;
  }>;
  connections: Record<string, any>;
  settings?: Record<string, any>;
}

interface N8nApiResponse<T> {
  data?: T;
  error?: string;
}

export class N8nClient {
  private baseUrl: string;
  private apiToken: string;

  constructor(baseUrl: string, apiToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiToken = apiToken;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<N8nApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Authorization': `Basic ${btoa('itadmin:Peritus2024')}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async createCredential(
    name: string,
    type: string,
    data: Record<string, any>,
    tags?: string[]
  ): Promise<N8nApiResponse<N8nCredential>> {
    return this.makeRequest<N8nCredential>('/credentials', {
      method: 'POST',
      body: JSON.stringify({
        name,
        type,
        data,
        tags,
      }),
    });
  }

  async getWorkflow(id: string): Promise<N8nApiResponse<N8nWorkflow>> {
    return this.makeRequest<N8nWorkflow>(`/workflows/${id}`);
  }

  async createWorkflow(workflow: {
    name: string;
    nodes: any[];
    connections: Record<string, any>;
    active?: boolean;
    tags?: string[];
  }): Promise<N8nApiResponse<N8nWorkflow>> {
    return this.makeRequest<N8nWorkflow>('/workflows', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
  }

  async patchWorkflow(
    id: string,
    updates: Partial<N8nWorkflow>
  ): Promise<N8nApiResponse<N8nWorkflow>> {
    return this.makeRequest<N8nWorkflow>(`/workflows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async activateWorkflow(id: string): Promise<N8nApiResponse<N8nWorkflow>> {
    return this.makeRequest<N8nWorkflow>(`/workflows/${id}/activate`, {
      method: 'POST',
    });
  }

  async deactivateWorkflow(id: string): Promise<N8nApiResponse<N8nWorkflow>> {
    return this.makeRequest<N8nWorkflow>(`/workflows/${id}/deactivate`, {
      method: 'POST',
    });
  }

  async getCredentialOAuthUrl(credentialId: string): Promise<N8nApiResponse<{ authUrl: string }>> {
    return this.makeRequest<{ authUrl: string }>(`/credentials/${credentialId}/oauth-url`);
  }

  async cloneWorkflow(
    templateId: string,
    name: string,
    credentialId: string,
    config: Record<string, any>,
    tags?: string[]
  ): Promise<N8nApiResponse<N8nWorkflow>> {
    // First, get the template workflow
    const templateResponse = await this.getWorkflow(templateId);
    if (templateResponse.error || !templateResponse.data) {
      return { error: templateResponse.error || 'Failed to get template workflow' };
    }

    const template = templateResponse.data;
    
    // Clone the workflow with new credential and config
    const clonedNodes = template.nodes.map(node => {
      if (node.type === 'Microsoft Outlook') {
        return {
          ...node,
          credentials: {
            ...node.credentials,
            microsoftOutlookOAuth2Api: credentialId,
          },
        };
      }
      
      if (node.name === 'Config' && node.type === 'Set') {
        return {
          ...node,
          parameters: {
            ...node.parameters,
            values: config,
          },
        };
      }
      
      return node;
    });

    return this.createWorkflow({
      name,
      nodes: clonedNodes,
      connections: template.connections,
      active: false,
      tags,
    });
  }
}