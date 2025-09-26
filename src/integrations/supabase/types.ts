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
          is_vip: boolean | null
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
          is_vip?: boolean | null
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
          is_vip?: boolean | null
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
      generated_replies: {
        Row: {
          created_at: string | null
          generated_content: string | null
          id: string
          original_email_id: string | null
          reply_type: string | null
          tenant_id: string
          user_id: string
          was_edited: boolean | null
          was_sent: boolean | null
        }
        Insert: {
          created_at?: string | null
          generated_content?: string | null
          id?: string
          original_email_id?: string | null
          reply_type?: string | null
          tenant_id: string
          user_id: string
          was_edited?: boolean | null
          was_sent?: boolean | null
        }
        Update: {
          created_at?: string | null
          generated_content?: string | null
          id?: string
          original_email_id?: string | null
          reply_type?: string | null
          tenant_id?: string
          user_id?: string
          was_edited?: boolean | null
          was_sent?: boolean | null
        }
        Relationships: []
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
      meeting_action_items: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string
          due_date: string | null
          id: string
          meeting_summary_id: string
          priority: string | null
          status: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          meeting_summary_id: string
          priority?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          meeting_summary_id?: string
          priority?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_action_items_meeting_summary_id_fkey"
            columns: ["meeting_summary_id"]
            isOneToOne: false
            referencedRelation: "meeting_summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_summaries: {
        Row: {
          action_items: Json | null
          created_at: string
          duration_minutes: number | null
          effectiveness_score: number | null
          id: string
          integration_type: string
          key_decisions: Json | null
          meeting_date: string
          meeting_id: string
          meeting_title: string
          participants: Json | null
          source_data: Json | null
          speaking_time_analysis: Json | null
          summary: string | null
          tenant_id: string
          transcript: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_items?: Json | null
          created_at?: string
          duration_minutes?: number | null
          effectiveness_score?: number | null
          id?: string
          integration_type: string
          key_decisions?: Json | null
          meeting_date: string
          meeting_id: string
          meeting_title: string
          participants?: Json | null
          source_data?: Json | null
          speaking_time_analysis?: Json | null
          summary?: string | null
          tenant_id: string
          transcript?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_items?: Json | null
          created_at?: string
          duration_minutes?: number | null
          effectiveness_score?: number | null
          id?: string
          integration_type?: string
          key_decisions?: Json | null
          meeting_date?: string
          meeting_id?: string
          meeting_title?: string
          participants?: Json | null
          source_data?: Json | null
          speaking_time_analysis?: Json | null
          summary?: string | null
          tenant_id?: string
          transcript?: string | null
          updated_at?: string
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
      teams_analytics: {
        Row: {
          average_effectiveness_score: number | null
          average_meeting_duration: number | null
          completed_action_items: number | null
          created_at: string
          id: string
          insights: Json | null
          meeting_patterns: Json | null
          most_active_participants: Json | null
          period_end: string
          period_start: string
          tenant_id: string
          total_action_items: number | null
          total_meeting_time_minutes: number | null
          total_meetings: number | null
          user_id: string
        }
        Insert: {
          average_effectiveness_score?: number | null
          average_meeting_duration?: number | null
          completed_action_items?: number | null
          created_at?: string
          id?: string
          insights?: Json | null
          meeting_patterns?: Json | null
          most_active_participants?: Json | null
          period_end: string
          period_start: string
          tenant_id: string
          total_action_items?: number | null
          total_meeting_time_minutes?: number | null
          total_meetings?: number | null
          user_id: string
        }
        Update: {
          average_effectiveness_score?: number | null
          average_meeting_duration?: number | null
          completed_action_items?: number | null
          created_at?: string
          id?: string
          insights?: Json | null
          meeting_patterns?: Json | null
          most_active_participants?: Json | null
          period_end?: string
          period_start?: string
          tenant_id?: string
          total_action_items?: number | null
          total_meeting_time_minutes?: number | null
          total_meetings?: number | null
          user_id?: string
        }
        Relationships: []
      }
      teams_settings: {
        Row: {
          action_item_extraction: boolean | null
          auto_transcription_enabled: boolean | null
          bot_enabled: boolean | null
          bot_name: string | null
          created_at: string
          id: string
          integration_type: string
          meeting_analytics_enabled: boolean | null
          microsoft_app_id: string | null
          microsoft_app_password: string | null
          notification_preferences: Json | null
          retention_days: number | null
          speaking_time_analysis: boolean | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_item_extraction?: boolean | null
          auto_transcription_enabled?: boolean | null
          bot_enabled?: boolean | null
          bot_name?: string | null
          created_at?: string
          id?: string
          integration_type: string
          meeting_analytics_enabled?: boolean | null
          microsoft_app_id?: string | null
          microsoft_app_password?: string | null
          notification_preferences?: Json | null
          retention_days?: number | null
          speaking_time_analysis?: boolean | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_item_extraction?: boolean | null
          auto_transcription_enabled?: boolean | null
          bot_enabled?: boolean | null
          bot_name?: string | null
          created_at?: string
          id?: string
          integration_type?: string
          meeting_analytics_enabled?: boolean | null
          microsoft_app_id?: string | null
          microsoft_app_password?: string | null
          notification_preferences?: Json | null
          retention_days?: number | null
          speaking_time_analysis?: boolean | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
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
      user_modules: {
        Row: {
          created_at: string | null
          expires_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          is_active: boolean | null
          module: Database["public"]["Enums"]["user_module"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          module: Database["public"]["Enums"]["user_module"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          is_active?: boolean | null
          module?: Database["public"]["Enums"]["user_module"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_modules_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_modules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      user_writing_profiles: {
        Row: {
          created_at: string | null
          emails_analyzed: number | null
          id: string
          last_analyzed_at: string | null
          signature: string | null
          tenant_id: string
          updated_at: string | null
          user_id: string
          writing_style: Json | null
        }
        Insert: {
          created_at?: string | null
          emails_analyzed?: number | null
          id?: string
          last_analyzed_at?: string | null
          signature?: string | null
          tenant_id: string
          updated_at?: string | null
          user_id: string
          writing_style?: Json | null
        }
        Update: {
          created_at?: string | null
          emails_analyzed?: number | null
          id?: string
          last_analyzed_at?: string | null
          signature?: string | null
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
          writing_style?: Json | null
        }
        Relationships: []
      }
      vip_email_addresses: {
        Row: {
          created_at: string
          display_name: string | null
          email_address: string
          id: string
          is_active: boolean
          notes: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email_address: string
          id?: string
          is_active?: boolean
          notes?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email_address?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          tenant_id?: string
          updated_at?: string
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
      can_see_threat_feed_api_key: {
        Args: { feed_is_preconfigured: boolean; feed_tenant_id: string }
        Returns: boolean
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_module_access: {
        Args: {
          _module: Database["public"]["Enums"]["user_module"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_threat_intelligence_access: {
        Args: { _user_id: string }
        Returns: boolean
      }
      trigger_feed_health_monitor: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      user_has_module_access: {
        Args: {
          _module: Database["public"]["Enums"]["user_module"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "super_admin"
        | "security_analyst"
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
        | "workflow_executed"
        | "queue_cleared"
        | "bulk_processing"
        | "manual_processing"
      mailbox_status: "pending" | "connected" | "error" | "paused"
      user_module: "email_management" | "security" | "teams"
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "super_admin",
        "security_analyst",
      ],
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
        "workflow_executed",
        "queue_cleared",
        "bulk_processing",
        "manual_processing",
      ],
      mailbox_status: ["pending", "connected", "error", "paused"],
      user_module: ["email_management", "security", "teams"],
    },
  },
} as const
