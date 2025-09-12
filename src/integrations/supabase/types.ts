export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          tenant_id: string | null
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          tenant_id?: string | null
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          tenant_id?: string | null
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown | null
          mailbox_id: string | null
          tenant_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          mailbox_id?: string | null
          tenant_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          mailbox_id?: string | null
          tenant_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      email_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          mailbox_id: string | null
          name: string
          priority: number | null
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          mailbox_id?: string | null
          name: string
          priority?: number | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          mailbox_id?: string | null
          name?: string
          priority?: number | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_categories_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      email_classification_rules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          rule_type: string
          rule_value: string
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          rule_type: string
          rule_value: string
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          rule_type?: string
          rule_value?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_classification_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "email_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      email_classifications: {
        Row: {
          category_id: string
          classification_method: string
          confidence_score: number | null
          created_at: string
          email_id: string
          id: string
          mailbox_id: string
          metadata: Json | null
          rule_id: string | null
          tenant_id: string
        }
        Insert: {
          category_id: string
          classification_method: string
          confidence_score?: number | null
          created_at?: string
          email_id: string
          id?: string
          mailbox_id: string
          metadata?: Json | null
          rule_id?: string | null
          tenant_id: string
        }
        Update: {
          category_id?: string
          classification_method?: string
          confidence_score?: number | null
          created_at?: string
          email_id?: string
          id?: string
          mailbox_id?: string
          metadata?: Json | null
          rule_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_classifications_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "email_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_classifications_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_classifications_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "email_classification_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      email_polling_status: {
        Row: {
          created_at: string
          errors_count: number | null
          id: string
          is_polling_active: boolean | null
          last_email_received_at: string | null
          last_error_message: string | null
          last_poll_at: string | null
          last_successful_poll_at: string | null
          mailbox_id: string
          polling_interval_minutes: number | null
          tenant_id: string
          total_emails_processed: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          errors_count?: number | null
          id?: string
          is_polling_active?: boolean | null
          last_email_received_at?: string | null
          last_error_message?: string | null
          last_poll_at?: string | null
          last_successful_poll_at?: string | null
          mailbox_id: string
          polling_interval_minutes?: number | null
          tenant_id: string
          total_emails_processed?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          errors_count?: number | null
          id?: string
          is_polling_active?: boolean | null
          last_email_received_at?: string | null
          last_error_message?: string | null
          last_poll_at?: string | null
          last_successful_poll_at?: string | null
          mailbox_id?: string
          polling_interval_minutes?: number | null
          tenant_id?: string
          total_emails_processed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_polling_status_mailbox"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          body_content: string | null
          body_preview: string | null
          conversation_id: string | null
          created_at: string
          error_message: string | null
          folder_id: string | null
          folder_name: string | null
          has_attachments: boolean | null
          id: string
          importance: string | null
          internet_message_id: string | null
          is_read: boolean | null
          mailbox_id: string
          microsoft_id: string
          processed_at: string | null
          processing_status: string | null
          received_at: string
          recipient_emails: string[] | null
          sender_email: string
          sender_name: string | null
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body_content?: string | null
          body_preview?: string | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          folder_id?: string | null
          folder_name?: string | null
          has_attachments?: boolean | null
          id?: string
          importance?: string | null
          internet_message_id?: string | null
          is_read?: boolean | null
          mailbox_id: string
          microsoft_id: string
          processed_at?: string | null
          processing_status?: string | null
          received_at: string
          recipient_emails?: string[] | null
          sender_email: string
          sender_name?: string | null
          subject: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body_content?: string | null
          body_preview?: string | null
          conversation_id?: string | null
          created_at?: string
          error_message?: string | null
          folder_id?: string | null
          folder_name?: string | null
          has_attachments?: boolean | null
          id?: string
          importance?: string | null
          internet_message_id?: string | null
          is_read?: boolean | null
          mailbox_id?: string
          microsoft_id?: string
          processed_at?: string | null
          processing_status?: string | null
          received_at?: string
          recipient_emails?: string[] | null
          sender_email?: string
          sender_name?: string | null
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_emails_mailbox"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mailbox_configs: {
        Row: {
          config: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          mailbox_id: string
          tenant_id: string
          version: number
        }
        Insert: {
          config: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mailbox_id: string
          tenant_id: string
          version?: number
        }
        Update: {
          config?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mailbox_id?: string
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "mailbox_configs_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      mailboxes: {
        Row: {
          created_at: string | null
          display_name: string
          email_address: string
          error_message: string | null
          id: string
          last_sync_at: string | null
          microsoft_graph_token: string | null
          status: Database["public"]["Enums"]["mailbox_status"] | null
          tenant_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name: string
          email_address: string
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          microsoft_graph_token?: string | null
          status?: Database["public"]["Enums"]["mailbox_status"] | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string
          email_address?: string
          error_message?: string | null
          id?: string
          last_sync_at?: string | null
          microsoft_graph_token?: string | null
          status?: Database["public"]["Enums"]["mailbox_status"] | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          account_status?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          tenant_id?: string
          updated_at?: string | null
        }
        Update: {
          account_status?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      threat_intelligence_feeds: {
        Row: {
          api_endpoint: string | null
          api_key: string | null
          api_key_required: boolean | null
          created_at: string
          description: string | null
          feed_type: string
          feed_url: string | null
          id: string
          is_active: boolean | null
          is_preconfigured: boolean | null
          last_updated_at: string | null
          name: string
          success_rate: number | null
          tenant_id: string | null
          total_entries: number | null
          update_frequency_hours: number | null
          updated_at: string
        }
        Insert: {
          api_endpoint?: string | null
          api_key?: string | null
          api_key_required?: boolean | null
          created_at?: string
          description?: string | null
          feed_type: string
          feed_url?: string | null
          id?: string
          is_active?: boolean | null
          is_preconfigured?: boolean | null
          last_updated_at?: string | null
          name: string
          success_rate?: number | null
          tenant_id?: string | null
          total_entries?: number | null
          update_frequency_hours?: number | null
          updated_at?: string
        }
        Update: {
          api_endpoint?: string | null
          api_key?: string | null
          api_key_required?: boolean | null
          created_at?: string
          description?: string | null
          feed_type?: string
          feed_url?: string | null
          id?: string
          is_active?: boolean | null
          is_preconfigured?: boolean | null
          last_updated_at?: string | null
          name?: string
          success_rate?: number | null
          tenant_id?: string | null
          total_entries?: number | null
          update_frequency_hours?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      threat_intelligence_results: {
        Row: {
          created_at: string
          details: Json | null
          email_id: string
          feed_id: string
          id: string
          tenant_id: string
          threat_indicator: string
          threat_score: number
          threat_type: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          email_id: string
          feed_id: string
          id?: string
          tenant_id: string
          threat_indicator: string
          threat_score: number
          threat_type: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          email_id?: string
          feed_id?: string
          id?: string
          tenant_id?: string
          threat_indicator?: string
          threat_score?: number
          threat_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "threat_intelligence_results_feed_id_fkey"
            columns: ["feed_id"]
            isOneToOne: false
            referencedRelation: "threat_intelligence_feeds"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflow_executions: {
        Row: {
          actions_taken: Json
          created_at: string
          email_id: string | null
          error_message: string | null
          execution_status: string
          execution_time_ms: number
          id: string
          mailbox_id: string
          rule_id: string | null
          tenant_id: string
        }
        Insert: {
          actions_taken?: Json
          created_at?: string
          email_id?: string | null
          error_message?: string | null
          execution_status: string
          execution_time_ms?: number
          id?: string
          mailbox_id: string
          rule_id?: string | null
          tenant_id: string
        }
        Update: {
          actions_taken?: Json
          created_at?: string
          email_id?: string | null
          error_message?: string | null
          execution_status?: string
          execution_time_ms?: number
          id?: string
          mailbox_id?: string
          rule_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_executions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "workflow_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          mailbox_id: string | null
          name: string
          priority: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          mailbox_id?: string | null
          name: string
          priority?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          mailbox_id?: string | null
          name?: string
          priority?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_rules_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_user_account: {
        Args: { user_email: string }
        Returns: undefined
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "super_admin"
      audit_action:
        | "mailbox_created"
        | "mailbox_connected"
        | "mailbox_paused"
        | "mailbox_resumed"
        | "config_updated"
        | "workflow_synced"
        | "error_occurred"
        | "email_received"
        | "email_processed"
        | "email_categorized"
        | "email_quarantined"
        | "email_blocked"
      mailbox_status: "pending" | "connected" | "error" | "paused"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "super_admin"],
      audit_action: [
        "mailbox_created",
        "mailbox_connected",
        "mailbox_paused",
        "mailbox_resumed",
        "config_updated",
        "workflow_synced",
        "error_occurred",
        "email_received",
        "email_processed",
        "email_categorized",
        "email_quarantined",
        "email_blocked",
      ],
      mailbox_status: ["pending", "connected", "error", "paused"],
    },
  },
} as const
