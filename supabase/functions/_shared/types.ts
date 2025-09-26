// Shared type definitions for Supabase Edge Functions

export interface Database {
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
          account_status?: string;
        };
        Insert: {
          id: string;
          tenant_id?: string;
          email: string;
          full_name?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          email?: string;
          full_name?: string | null;
          account_status?: string;
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
          microsoft_graph_token?: string | null;
          last_sync_at?: string | null;
          error_message?: string | null;
        };
        Update: {
          status?: "pending" | "connected" | "error" | "paused";
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
          created_at: string;
        };
        Insert: {
          tenant_id: string;
          mailbox_id?: string | null;
          user_id?: string | null;
          action: string;
          details?: any | null;
          ip_address?: string | null;
        };
      };
      emails: {
        Row: {
          id: string;
          tenant_id: string;
          mailbox_id: string;
          microsoft_id: string;
          count?: number;
        };
      };
    };
  };
}

export interface HealthCheckResult {
  timestamp: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  checks: {
    database?: { status: 'ok' | 'error'; message: string };
    [key: string]: any;
  };
  errors: string[];
}

export interface MicrosoftErrorDetails {
  error?: string;
  error_description?: string;
  error_codes?: number[];
  timestamp?: string;
  trace_id?: string;
  correlation_id?: string;
}