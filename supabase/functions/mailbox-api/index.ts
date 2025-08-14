import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      mailboxes: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          email_address: string;
          display_name: string;
          status: "pending" | "connected" | "error" | "paused";
          n8n_credential_id: string | null;
          n8n_workflow_id: string | null;
          microsoft_graph_token: string | null;
          last_sync_at: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          email_address: string;
          display_name: string;
          status?: "pending" | "connected" | "error" | "paused";
          n8n_credential_id?: string | null;
          n8n_workflow_id?: string | null;
          microsoft_graph_token?: string | null;
          last_sync_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "connected" | "error" | "paused";
          n8n_credential_id?: string | null;
          n8n_workflow_id?: string | null;
          microsoft_graph_token?: string | null;
          last_sync_at?: string | null;
          error_message?: string | null;
          updated_at?: string;
        };
      };
      mailbox_configs: {
        Row: {
          id: string;
          mailbox_id: string;
          tenant_id: string;
          version: number;
          config: any;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          mailbox_id: string;
          tenant_id: string;
          version?: number;
          config: any;
          is_active?: boolean;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          tenant_id: string;
          mailbox_id: string | null;
          user_id: string | null;
          action: string;
          details: any | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          mailbox_id?: string | null;
          user_id?: string | null;
          action: string;
          details?: any | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
    };
  };
}

class N8nClient {
  private baseUrl: string;
  private apiToken: string;

  constructor(baseUrl: string, apiToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiToken = apiToken;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data?: T; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
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

  async createCredential(name: string, type: string, data: Record<string, any>, tags?: string[]) {
    return this.makeRequest('/credentials', {
      method: 'POST',
      body: JSON.stringify({ name, type, data, tags }),
    });
  }

  async getCredentialOAuthUrl(credentialId: string) {
    return this.makeRequest<{ authUrl: string }>(`/credentials/${credentialId}/oauth-url`);
  }

  async getWorkflow(id: string) {
    return this.makeRequest(`/workflows/${id}`);
  }

  async createWorkflow(workflow: {
    name: string;
    nodes: any[];
    connections: Record<string, any>;
    active?: boolean;
    tags?: string[];
  }) {
    return this.makeRequest('/workflows', {
      method: 'POST',
      body: JSON.stringify(workflow),
    });
  }

  async patchWorkflow(id: string, updates: any) {
    return this.makeRequest(`/workflows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async activateWorkflow(id: string) {
    return this.makeRequest(`/workflows/${id}/activate`, {
      method: 'POST',
    });
  }

  async deactivateWorkflow(id: string) {
    return this.makeRequest(`/workflows/${id}/deactivate`, {
      method: 'POST',
    });
  }
}

async function logAudit(
  supabase: any,
  tenantId: string,
  action: string,
  details: any,
  mailboxId?: string,
  userId?: string,
  req?: Request
) {
  try {
    const ip = req?.headers.get('x-forwarded-for') || 
               req?.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = req?.headers.get('user-agent') || 'unknown';

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      mailbox_id: mailboxId,
      user_id: userId,
      action,
      details,
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const n8nClient = new N8nClient(
      Deno.env.get('N8N_BASE_URL') ?? 'https://agent.lyfeai.com.au',
      Deno.env.get('N8N_API_TOKEN') ?? ''
    );

    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Get user from JWT (automatically handled by Supabase when verify_jwt = true)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant_id
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.tenant_id;

    // Route handling
    if (path.includes('/mailbox-api') && method === 'POST') {
      // Create new mailbox
      const body = await req.json();
      const { emailAddress, displayName, preset } = body;

      // For now, create a mock credential ID and OAuth URL for testing
      // TODO: Replace with actual n8n integration once environment variables are configured
      const mockCredentialId = `mock-${Date.now()}`;
      const mockOAuthUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=mock&response_type=code&redirect_uri=${encodeURIComponent(
        `${req.headers.get('origin')}/auth/callback`
      )}&scope=openid%20profile%20email%20Mail.ReadWrite`;

      // Skip n8n calls for now
      // const credentialResponse = await n8nClient.createCredential(...)
      // if (credentialResponse.error) { ... }
      
      const credentialId = mockCredentialId;

      // Create mailbox in database
      const { data: mailbox, error: dbError } = await supabaseClient
        .from('mailboxes')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          email_address: emailAddress,
          display_name: displayName,
          status: 'pending',
          n8n_credential_id: credentialId,
        })
        .select()
        .single();

      if (dbError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create mailbox' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Mock OAuth URL for testing
      // const oauthResponse = await n8nClient.getCredentialOAuthUrl(credentialId);
      // if (oauthResponse.error) { ... }
      
      const authUrl = mockOAuthUrl;

      await logAudit(supabaseClient, tenantId, 'mailbox_created', {
        mailbox_id: mailbox.id,
        email_address: emailAddress,
        preset,
      }, mailbox.id, user.id, req);

      return new Response(
        JSON.stringify({
          mailbox,
          authUrl: authUrl,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle mailbox state changes (pause/resume)
    const stateMatch = path.match(/\/mailbox-api\/([^\/]+)\/state$/);
    if (stateMatch && method === 'PATCH') {
      const mailboxId = stateMatch[1];
      const body = await req.json();
      const { action } = body; // 'pause' or 'resume'

      // Get mailbox
      const { data: mailbox } = await supabaseClient
        .from('mailboxes')
        .select('*')
        .eq('id', mailboxId)
        .eq('tenant_id', tenantId)
        .single();

      if (!mailbox) {
        return new Response(
          JSON.stringify({ error: 'Mailbox not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newStatus = action === 'pause' ? 'paused' : 'connected';
      
      // Update workflow in n8n
      if (mailbox.n8n_workflow_id) {
        if (action === 'pause') {
          await n8nClient.deactivateWorkflow(mailbox.n8n_workflow_id);
        } else {
          await n8nClient.activateWorkflow(mailbox.n8n_workflow_id);
        }
      }

      // Update database
      await supabaseClient
        .from('mailboxes')
        .update({ status: newStatus })
        .eq('id', mailboxId);

      await logAudit(supabaseClient, tenantId, action === 'pause' ? 'mailbox_paused' : 'mailbox_resumed', {
        mailbox_id: mailboxId,
      }, mailboxId, user.id, req);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});