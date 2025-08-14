import { supabase } from "@/integrations/supabase/client";

export class ApiClient {
  private async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }

  async createMailbox(data: {
    emailAddress: string;
    displayName: string;
    preset: string;
  }) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch('/api/mailbox-api', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create mailbox');
    }

    return response.json();
  }

  async updateMailboxState(mailboxId: string, action: 'pause' | 'resume') {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`/api/mailbox-api/${mailboxId}/state`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update mailbox state');
    }

    return response.json();
  }

  async updateMailboxConfig(mailboxId: string, config: Record<string, any>) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`/api/mailbox-api/${mailboxId}/config`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ config }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update mailbox config');
    }

    return response.json();
  }

  async getMailboxStatus(mailboxId: string) {
    const headers = await this.getAuthHeaders();
    
    const response = await fetch(`/api/mailbox-api/${mailboxId}/status`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get mailbox status');
    }

    return response.json();
  }
}

export const api = new ApiClient();