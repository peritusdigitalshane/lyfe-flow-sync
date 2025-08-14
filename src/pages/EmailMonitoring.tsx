import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { emailPollingService, EmailPollingStatus, Email } from "@/services/emailPollingService";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, RefreshCw, Play, Pause, AlertCircle, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface MailboxWithStats {
  id: string;
  email_address: string;
  display_name: string;
  status: string;
  polling_status?: EmailPollingStatus;
  stats?: {
    total: number;
    pending: number;
    processed: number;
    failed: number;
    today: number;
    thisWeek: number;
  };
}

const EmailMonitoring = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [mailboxes, setMailboxes] = useState<MailboxWithStats[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [pollingLoading, setPollingLoading] = useState(false);
  const [emailsLoading, setEmailsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load mailboxes
      const { data: mailboxData, error: mailboxError } = await supabase
        .from('mailboxes')
        .select('*')
        .eq('status', 'connected');

      if (mailboxError) throw mailboxError;

      // Load polling status for each mailbox
      const mailboxesWithStatus: MailboxWithStats[] = [];
      
      for (const mailbox of mailboxData || []) {
        const { data: pollingStatus } = await emailPollingService.getMailboxPollingStatus(mailbox.id);
        const stats = await emailPollingService.getEmailStats(mailbox.id);
        
        mailboxesWithStatus.push({
          ...mailbox,
          polling_status: pollingStatus,
          stats
        });
      }

      setMailboxes(mailboxesWithStatus);

      // Select first mailbox by default
      if (mailboxesWithStatus.length > 0 && !selectedMailbox) {
        setSelectedMailbox(mailboxesWithStatus[0].id);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load email monitoring data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEmails = async (mailboxId: string) => {
    try {
      setEmailsLoading(true);
      const { data, error } = await emailPollingService.getEmails(mailboxId, {
        limit: 50,
        orderBy: 'received_at',
        ascending: false
      });

      if (error) throw error;
      setEmails(data || []);
    } catch (error) {
      console.error('Error loading emails:', error);
      toast({
        title: "Error",
        description: "Failed to load emails",
        variant: "destructive",
      });
    } finally {
      setEmailsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMailbox) {
      loadEmails(selectedMailbox);
    }
  }, [selectedMailbox]);

  const triggerPolling = async () => {
    try {
      setPollingLoading(true);
      const result = await emailPollingService.triggerEmailPolling();
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Email polling completed. ${result.total_processed} emails processed.`,
        });
        
        // Refresh data
        await loadData();
        if (selectedMailbox) {
          await loadEmails(selectedMailbox);
        }
      } else {
        throw new Error(result.error || 'Polling failed');
      }
    } catch (error) {
      console.error('Error triggering polling:', error);
      toast({
        title: "Error",
        description: "Failed to trigger email polling",
        variant: "destructive",
      });
    } finally {
      setPollingLoading(false);
    }
  };

  const togglePollingForMailbox = async (mailboxId: string, currentlyActive: boolean) => {
    try {
      const { error } = await emailPollingService.updatePollingConfig(mailboxId, {
        is_polling_active: !currentlyActive
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Polling ${!currentlyActive ? 'enabled' : 'disabled'} for mailbox`,
      });

      await loadData();
    } catch (error) {
      console.error('Error toggling polling:', error);
      toast({
        title: "Error",
        description: "Failed to update polling status",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Monitoring</h1>
          <p className="text-muted-foreground">Monitor and manage email polling from your connected mailboxes</p>
        </div>
        <Button onClick={triggerPolling} disabled={pollingLoading}>
          {pollingLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Poll Now
        </Button>
      </div>

      {/* Mailbox Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mailboxes.map((mailbox) => (
          <Card 
            key={mailbox.id} 
            className={`cursor-pointer transition-colors ${
              selectedMailbox === mailbox.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setSelectedMailbox(mailbox.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{mailbox.display_name}</CardTitle>
                <div className="flex items-center space-x-2">
                  {mailbox.polling_status?.is_polling_active ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <Play className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <Pause className="w-3 h-3 mr-1" />
                      Paused
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription>{mailbox.email_address}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Emails</p>
                  <p className="font-semibold">{mailbox.stats?.total || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Today</p>
                  <p className="font-semibold">{mailbox.stats?.today || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pending</p>
                  <p className="font-semibold text-orange-600">{mailbox.stats?.pending || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Processed</p>
                  <p className="font-semibold text-green-600">{mailbox.stats?.processed || 0}</p>
                </div>
              </div>
              
              {mailbox.polling_status?.last_successful_poll_at && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Last synced: {formatDistanceToNow(new Date(mailbox.polling_status.last_successful_poll_at), { addSuffix: true })}
                  </p>
                </div>
              )}

              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePollingForMailbox(mailbox.id, mailbox.polling_status?.is_polling_active || false);
                  }}
                >
                  {mailbox.polling_status?.is_polling_active ? (
                    <Pause className="w-4 h-4 mr-1" />
                  ) : (
                    <Play className="w-4 h-4 mr-1" />
                  )}
                  {mailbox.polling_status?.is_polling_active ? 'Pause' : 'Resume'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Email List */}
      {selectedMailbox && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="mr-2 h-5 w-5" />
              Recent Emails
            </CardTitle>
            <CardDescription>
              Emails from {mailboxes.find(m => m.id === selectedMailbox)?.email_address}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : emails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No emails found for this mailbox
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.map((email) => (
                    <TableRow key={email.id}>
                      <TableCell className="font-medium">
                        {email.subject}
                        {email.has_attachments && (
                          <Badge variant="outline" className="ml-2">📎</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{email.sender_name || email.sender_email}</p>
                          {email.sender_name && (
                            <p className="text-sm text-muted-foreground">{email.sender_email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            email.processing_status === 'processed' ? 'default' :
                            email.processing_status === 'failed' ? 'destructive' :
                            'secondary'
                          }
                        >
                          {email.processing_status === 'processed' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {email.processing_status === 'failed' && <AlertCircle className="w-3 h-3 mr-1" />}
                          {email.processing_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {email.processing_status === 'pending' && (
                          <Button size="sm" variant="outline">
                            Process
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EmailMonitoring;