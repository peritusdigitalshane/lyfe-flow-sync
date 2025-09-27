import { useState, useEffect } from "react";
import { ImprovedNavigation } from "@/components/ImprovedNavigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { emailPollingService, EmailPollingStatus, Email } from "@/services/emailPollingService";
import { useAuth } from "@/hooks/useAuth";
import { EmailReplyAssistant } from "@/components/EmailReplyAssistant";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, RefreshCw, Play, Pause, AlertCircle, CheckCircle, Settings, Eye, EyeOff, Wand2 } from "lucide-react";
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
  const [pollingDialogOpen, setPollingDialogOpen] = useState(false);
  const [maxEmails, setMaxEmails] = useState(50);
  const [hoursBack, setHoursBack] = useState<number | ''>('');
  const [selectedEmailForReply, setSelectedEmailForReply] = useState<Email | null>(null);
  const [showReplyAssistant, setShowReplyAssistant] = useState(false);
  const [hiddenEmails, setHiddenEmails] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);

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

  const triggerPolling = async (options?: { maxEmails?: number; hoursBack?: number }) => {
    try {
      setPollingLoading(true);
      const result = await emailPollingService.triggerEmailPolling(options);
      
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
      setPollingDialogOpen(false);
    }
  };

  const handleCustomPolling = async () => {
    const options: { maxEmails?: number; hoursBack?: number } = {};
    
    if (maxEmails > 0) {
      options.maxEmails = maxEmails;
    }
    
    if (hoursBack !== '' && hoursBack > 0) {
      options.hoursBack = hoursBack;
    }
    
    await triggerPolling(options);
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

  const handleReplyClick = (email: Email) => {
    setSelectedEmailForReply(email);
    setShowReplyAssistant(true);
  };

  const handleHideEmail = (emailId: string) => {
    setHiddenEmails(prev => new Set([...prev, emailId]));
    toast({
      title: "Email hidden",
      description: "Email removed from active list",
    });
  };

  const handleUnhideEmail = (emailId: string) => {
    setHiddenEmails(prev => {
      const newSet = new Set(prev);
      newSet.delete(emailId);
      return newSet;
    });
    toast({
      title: "Email restored",
      description: "Email restored to active list",
    });
  };

  const filteredEmails = showHidden 
    ? emails.filter(email => hiddenEmails.has(email.id))
    : emails.filter(email => !hiddenEmails.has(email.id));

  const closeReplyAssistant = () => {
    setShowReplyAssistant(false);
    setSelectedEmailForReply(null);
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
    <div className="min-h-screen bg-background">
      <ImprovedNavigation />
      <main className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Monitoring</h1>
          <p className="text-muted-foreground">Monitor and manage email polling from your connected mailboxes</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => triggerPolling()} disabled={pollingLoading}>
            {pollingLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Poll Now
          </Button>
          
          <Dialog open={pollingDialogOpen} onOpenChange={setPollingDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={pollingLoading}>
                <Settings className="mr-2 h-4 w-4" />
                Custom Poll
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Custom Email Polling</DialogTitle>
                <DialogDescription>
                  Configure how many emails to scan and how far back to look.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="maxEmails" className="text-right">
                    Max Emails
                  </Label>
                  <Input
                    id="maxEmails"
                    type="number"
                    value={maxEmails}
                    onChange={(e) => setMaxEmails(Number(e.target.value))}
                    className="col-span-3"
                    min="1"
                    max="500"
                    placeholder="50"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="hoursBack" className="text-right">
                    Hours Back
                  </Label>
                  <Input
                    id="hoursBack"
                    type="number"
                    value={hoursBack}
                    onChange={(e) => setHoursBack(e.target.value === '' ? '' : Number(e.target.value))}
                    className="col-span-3"
                    min="1"
                    max="168"
                    placeholder="Leave empty for new emails only"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>• Max Emails: Up to 500 emails per poll (default: 50)</p>
                  <p>• Hours Back: How many hours back to scan (default: only new emails since last poll)</p>
                  <p>• Leave Hours Back empty to only get new emails since the last successful poll</p>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleCustomPolling} 
                  disabled={pollingLoading}
                  className="w-full"
                >
                  {pollingLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Start Custom Poll
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
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
            <CardDescription className="flex items-center justify-between">
              <span>Emails from {mailboxes.find(m => m.id === selectedMailbox)?.email_address}</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowHidden(!showHidden)}
                  className="text-xs"
                >
                  {showHidden ? (
                    <>
                      <Eye className="w-4 h-4 mr-1" />
                      Show Active
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-4 h-4 mr-1" />
                      Show Hidden ({hiddenEmails.size})
                    </>
                  )}
                </Button>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {emailsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {showHidden 
                  ? "No hidden emails found" 
                  : "No emails found for this mailbox"}
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
                  {filteredEmails.map((email) => (
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
                        <div className="flex gap-2">
                          {!showHidden ? (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleReplyClick(email)}
                              >
                                <Wand2 className="w-4 h-4 mr-1" />
                                Reply
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleHideEmail(email.id)}
                                className="text-orange-600 hover:text-orange-700"
                              >
                                <EyeOff className="w-4 h-4 mr-1" />
                                Hide
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleUnhideEmail(email.id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Restore
                            </Button>
                          )}
                          {email.processing_status === 'pending' && (
                            <Button size="sm" variant="outline">
                              Process
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Email Reply Assistant Modal */}
      {selectedEmailForReply && (
        <EmailReplyAssistant
          open={showReplyAssistant}
          onClose={closeReplyAssistant}
          email={selectedEmailForReply}
        />
      )}
        </div>
      </main>
    </div>
  );
};

export default EmailMonitoring;