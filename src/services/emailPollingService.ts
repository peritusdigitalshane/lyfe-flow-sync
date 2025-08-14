import { supabase } from "@/integrations/supabase/client";

export interface EmailPollingStatus {
  id: string;
  tenant_id: string;
  mailbox_id: string;
  last_poll_at?: string;
  last_successful_poll_at?: string;
  last_email_received_at?: string;
  total_emails_processed: number;
  errors_count: number;
  last_error_message?: string;
  is_polling_active: boolean;
  polling_interval_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface Email {
  id: string;
  tenant_id: string;
  mailbox_id: string;
  microsoft_id: string;
  subject: string;
  sender_email: string;
  sender_name?: string;
  recipient_emails: string[];
  body_content?: string;
  body_preview?: string;
  received_at: string;
  is_read: boolean;
  importance: string;
  has_attachments: boolean;
  folder_id?: string;
  folder_name?: string;
  internet_message_id?: string;
  conversation_id?: string;
  created_at: string;
  updated_at: string;
  processed_at?: string;
  processing_status: string;
  error_message?: string;
}

class EmailPollingService {
  /**
   * Trigger manual email polling for all active mailboxes
   */
  async triggerEmailPolling(): Promise<{
    success: boolean;
    message: string;
    total_processed?: number;
    mailbox_results?: any[];
    error?: string;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('email-poller');
      
      if (error) {
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error triggering email polling:', error);
      return {
        success: false,
        message: 'Failed to trigger email polling',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get polling status for all mailboxes in the current tenant
   */
  async getPollingStatus(): Promise<{ data: EmailPollingStatus[] | null; error: any }> {
    return await supabase
      .from('email_polling_status')
      .select('*')
      .order('updated_at', { ascending: false });
  }

  /**
   * Get polling status for a specific mailbox
   */
  async getMailboxPollingStatus(mailboxId: string): Promise<{ data: EmailPollingStatus | null; error: any }> {
    return await supabase
      .from('email_polling_status')
      .select('*')
      .eq('mailbox_id', mailboxId)
      .single();
  }

  /**
   * Update polling configuration for a mailbox
   */
  async updatePollingConfig(mailboxId: string, config: {
    is_polling_active?: boolean;
    polling_interval_minutes?: number;
  }): Promise<{ data: EmailPollingStatus | null; error: any }> {
    return await supabase
      .from('email_polling_status')
      .update(config)
      .eq('mailbox_id', mailboxId)
      .select()
      .single();
  }

  /**
   * Get emails for a specific mailbox with filtering options
   */
  async getEmails(mailboxId: string, options: {
    limit?: number;
    offset?: number;
    status?: string;
    search?: string;
    orderBy?: 'received_at' | 'created_at';
    ascending?: boolean;
  } = {}): Promise<{ data: Email[] | null; error: any; count?: number }> {
    const {
      limit = 50,
      offset = 0,
      status,
      search,
      orderBy = 'received_at',
      ascending = false
    } = options;

    let query = supabase
      .from('emails')
      .select('*', { count: 'exact' })
      .eq('mailbox_id', mailboxId);

    if (status) {
      query = query.eq('processing_status', status);
    }

    if (search) {
      query = query.or(`subject.ilike.%${search}%,sender_email.ilike.%${search}%,sender_name.ilike.%${search}%`);
    }

    query = query
      .order(orderBy, { ascending })
      .range(offset, offset + limit - 1);

    return await query;
  }

  /**
   * Get email statistics for a mailbox
   */
  async getEmailStats(mailboxId: string): Promise<{
    total: number;
    pending: number;
    processed: number;
    failed: number;
    today: number;
    thisWeek: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Get total counts by status
      const { data: statusCounts } = await supabase
        .from('emails')
        .select('processing_status')
        .eq('mailbox_id', mailboxId);

      // Get counts for today and this week
      const { data: recentEmails } = await supabase
        .from('emails')
        .select('received_at')
        .eq('mailbox_id', mailboxId)
        .gte('received_at', weekAgo.toISOString());

      const total = statusCounts?.length || 0;
      const pending = statusCounts?.filter(e => e.processing_status === 'pending').length || 0;
      const processed = statusCounts?.filter(e => e.processing_status === 'processed').length || 0;
      const failed = statusCounts?.filter(e => e.processing_status === 'failed').length || 0;

      const todayStr = today.toISOString().split('T')[0];
      const today_count = recentEmails?.filter(e => 
        e.received_at.startsWith(todayStr)
      ).length || 0;

      const thisWeek = recentEmails?.length || 0;

      return {
        total,
        pending,
        processed,
        failed,
        today: today_count,
        thisWeek
      };
    } catch (error) {
      console.error('Error getting email stats:', error);
      return {
        total: 0,
        pending: 0,
        processed: 0,
        failed: 0,
        today: 0,
        thisWeek: 0
      };
    }
  }

  /**
   * Mark emails as processed
   */
  async markEmailsAsProcessed(emailIds: string[]): Promise<{ data: any; error: any }> {
    return await supabase
      .from('emails')
      .update({
        processing_status: 'processed',
        processed_at: new Date().toISOString()
      })
      .in('id', emailIds);
  }

  /**
   * Initialize polling status for a new mailbox
   */
  async initializePollingForMailbox(mailboxId: string, tenantId: string): Promise<{ data: EmailPollingStatus | null; error: any }> {
    return await supabase
      .from('email_polling_status')
      .upsert({
        tenant_id: tenantId,
        mailbox_id: mailboxId,
        is_polling_active: true,
        polling_interval_minutes: 5,
        total_emails_processed: 0,
        errors_count: 0
      })
      .select()
      .single();
  }
}

export const emailPollingService = new EmailPollingService();