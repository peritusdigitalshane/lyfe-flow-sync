import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRoles } from '@/hooks/useRoles';
import { supabase } from '@/integrations/supabase/client';
import { emailWorkflowEngine } from '@/services/emailWorkflowEngine';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Play, Pause, Settings, ExternalLink, Loader2, User, LogOut, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface WorkflowExecution {
  id: string;
  email_id: string;
  mailbox_id: string;
  rule_id: string | null;
  execution_status: 'pending' | 'completed' | 'failed';
  actions_taken: any[];
  error_message: string | null;
  execution_time_ms: number;
  created_at: string;
}

interface WorkflowRule {
  id: string;
  name: string;
  mailbox_id: string | null;
  is_active: boolean;
  priority: number;
  conditions: any[];
  actions: any[];
  created_at: string;
  updated_at: string;
}

interface Mailbox {
  id: string;
  email_address: string;
  display_name: string;
  status: 'pending' | 'connected' | 'error' | 'paused';
}

import { ImprovedNavigation } from "@/components/ImprovedNavigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function WorkflowManagement() {
  const { user } = useAuth();
  const { isSuperAdmin } = useRoles();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isReprocessing, setIsReprocessing] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load mailboxes
      const { data: mailboxData, error: mailboxError } = await supabase
        .from('mailboxes')
        .select('*')
        .order('created_at', { ascending: false });

      if (mailboxError) throw mailboxError;

      // Load workflow rules
      const { data: rulesData, error: rulesError } = await supabase
        .from('workflow_rules')
        .select('*')
        .order('priority', { ascending: false });

      if (rulesError) throw rulesError;

      // Load recent workflow executions
      const { data: executionsData, error: executionsError } = await supabase
        .from('workflow_executions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (executionsError) throw executionsError;

      setMailboxes(mailboxData || []);
      
      // Convert JSON fields to proper types for rules
      const convertedRules = (rulesData || []).map(rule => ({
        ...rule,
        conditions: Array.isArray(rule.conditions) ? rule.conditions as unknown as any[] : [],
        actions: Array.isArray(rule.actions) ? rule.actions as unknown as any[] : []
      } as WorkflowRule));
      
      // Convert JSON fields to proper types for executions  
      const convertedExecutions = (executionsData || []).map(execution => ({
        ...execution,
        actions_taken: Array.isArray(execution.actions_taken) ? execution.actions_taken : [],
        execution_status: execution.execution_status as 'pending' | 'completed' | 'failed'
      } as WorkflowExecution));

      setRules(convertedRules);
      setExecutions(convertedExecutions);

    } catch (error) {
      console.error('Error loading workflow data:', error);
      toast.error('Failed to load workflow data');
    } finally {
      setLoading(false);
    }
  };

  const processEmailsForMailbox = async (mailboxId: string) => {
    try {
      setActionLoading(mailboxId);

      // First, trigger email polling to get new emails
      console.log('Triggering email polling...');
      const { data: pollResult, error: pollError } = await supabase.functions.invoke('email-poller', {
        body: { maxEmails: 10, hoursBack: 24 }
      });

      if (pollError) {
        console.error('Email polling error:', pollError);
        toast.error('Failed to poll emails: ' + pollError.message);
        return;
      }

      console.log('Polling result:', pollResult);

      // Get recent unprocessed emails for this mailbox
      const { data: emails, error: emailsError } = await supabase
        .from('emails')
        .select('*')
        .eq('mailbox_id', mailboxId)
        .eq('processing_status', 'pending')
        .limit(10);

      if (emailsError) throw emailsError;

      if (!emails || emails.length === 0) {
        toast.success(`Email polling completed. Found ${pollResult?.total_processed || 0} new emails. No pending emails to process.`);
        return;
      }

      // Process emails through the workflow engine
      const result = await emailWorkflowEngine.processEmailBatch(emails);
      
      toast.success(`Processed ${result.processed} emails successfully${result.failed > 0 ? `, ${result.failed} failed` : ''}`);
      
      await loadData(); // Refresh data

    } catch (error) {
      console.error('Error processing emails:', error);
      toast.error('Failed to process emails');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleRuleStatus = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('workflow_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId);

      if (error) throw error;

      toast.success(`Workflow rule ${isActive ? 'enabled' : 'disabled'}`);
      await loadData();

    } catch (error) {
      console.error('Error updating rule status:', error);
      toast.error('Failed to update rule status');
    }
  };

  const handleReprocessEmails = async () => {
    setIsReprocessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('reprocess-emails');
      
      if (error) {
        toast.error("Failed to reprocess emails");
        return;
      }

      if (data.success) {
        toast.success(data.message);
        await loadData(); // Refresh data
      } else {
        toast.error(data.error || "Failed to reprocess emails");
      }
    } catch (error) {
      toast.error("Error reprocessing emails");
    } finally {
      setIsReprocessing(false);
    }
  };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="default" className="bg-status-success text-white">Connected</Badge>;
      case 'paused':
        return <Badge variant="secondary">Paused</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getExecutionBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-status-success text-white">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };


  if (!user) {
    window.location.href = "/auth";
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading workflow data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ImprovedNavigation />
      <main className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Workflow Management</h1>
            <p className="text-muted-foreground mt-2">
              Monitor and manage your email automation workflows
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={handleReprocessEmails} 
              disabled={isReprocessing}
              variant="secondary"
              className="gap-2"
            >
              {isReprocessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Reprocessing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Reprocess Last 50 Emails
                </>
              )}
            </Button>
            <Button asChild variant="premium" className="gap-2">
              <Link to="/workflow-rules">
                <Plus className="h-4 w-4" />
                Create Rule
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Mailboxes Section */}
          <Card>
            <CardHeader>
              <CardTitle>Connected Mailboxes</CardTitle>
              <CardDescription>
                Process emails through automated workflows for each mailbox
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mailboxes.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No mailboxes connected</p>
                  <Button asChild variant="premium" size="sm" className="mt-4">
                    <Link to="/add-mailbox">Connect Mailbox</Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mailbox</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mailboxes.map((mailbox) => (
                      <TableRow key={mailbox.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{mailbox.display_name}</div>
                            <div className="text-sm text-muted-foreground">{mailbox.email_address}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(mailbox.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {mailbox.status === 'connected' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => processEmailsForMailbox(mailbox.id)}
                                disabled={actionLoading === mailbox.id}
                                className="gap-1"
                              >
                                {actionLoading === mailbox.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                                Process Emails
                              </Button>
                            )}
                            <Link to={`/mailbox/${mailbox.id}/settings`}>
                              <Button variant="outline" size="sm" className="gap-1">
                                <Settings className="h-3 w-3" />
                                Settings
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Active Workflow Rules */}
          <Card>
            <CardHeader>
              <CardTitle>Active Workflow Rules</CardTitle>
              <CardDescription>
                Manage your automated email processing rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No workflow rules created</p>
                  <Button asChild variant="premium" size="sm" className="mt-4">
                    <Link to="/workflow-rules">Create Rule</Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Mailbox</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule) => {
                      const targetMailbox = rule.mailbox_id 
                        ? mailboxes.find(m => m.id === rule.mailbox_id)
                        : null;
                      
                      return (
                        <TableRow key={rule.id}>
                          <TableCell>
                            <div className="font-medium">{rule.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {rule.conditions.length} conditions, {rule.actions.length} actions
                            </div>
                          </TableCell>
                          <TableCell>
                            {targetMailbox ? targetMailbox.display_name : 'All Mailboxes'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{rule.priority}</Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={rule.is_active}
                              onCheckedChange={(checked) => toggleRuleStatus(rule.id, checked)}
                            />
                          </TableCell>
                          <TableCell>
                            <Link to="/workflow-rules">
                              <Button variant="outline" size="sm" className="gap-1">
                                <Settings className="h-3 w-3" />
                                Edit
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Recent Workflow Executions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Workflow Executions</CardTitle>
              <CardDescription>
                View the latest automated email processing activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {executions.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No workflow executions yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email ID</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions Taken</TableHead>
                      <TableHead>Execution Time</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions.slice(0, 10).map((execution) => {
                      const rule = execution.rule_id 
                        ? rules.find(r => r.id === execution.rule_id)
                        : null;
                      
                      return (
                        <TableRow key={execution.id}>
                          <TableCell>
                            <code className="text-xs">{execution.email_id.slice(0, 8)}...</code>
                          </TableCell>
                          <TableCell>
                            {rule ? rule.name : 'No rule matched'}
                          </TableCell>
                          <TableCell>
                            {getExecutionBadge(execution.execution_status)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {execution.actions_taken.length > 0 
                                ? `${execution.actions_taken.length} actions`
                                : 'No actions'
                              }
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {execution.execution_time_ms}ms
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {new Date(execution.created_at).toLocaleString()}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}