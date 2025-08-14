import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { workflowCloner } from '@/lib/n8nWorkflowCloner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Play, Pause, Copy, Settings, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface N8NBinding {
  id: string;
  mailbox_id: string;
  n8n_workflow_id: string;
  n8n_credential_id: string;
  workflow_name: string;
  is_active: boolean;
  last_synced_at: string | null;
}

interface Mailbox {
  id: string;
  email_address: string;
  display_name: string;
  status: 'pending' | 'connected' | 'error' | 'paused';
  n8n_workflow_id: string | null;
  n8n_credential_id: string | null;
  microsoft_graph_token: string | null;
}

export default function WorkflowManagement() {
  const { user } = useAuth();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [bindings, setBindings] = useState<N8NBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
      setMailboxes(mailboxData || []);

      // Load n8n bindings
      const { data: bindingData, error: bindingError } = await supabase
        .from('n8n_bindings')
        .select('*')
        .order('created_at', { ascending: false });

      if (bindingError) throw bindingError;
      setBindings(bindingData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load workflow data');
    } finally {
      setLoading(false);
    }
  };

  const cloneWorkflowForMailbox = async (mailboxId: string) => {
    try {
      setActionLoading(mailboxId);

      const mailbox = mailboxes.find(m => m.id === mailboxId);
      if (!mailbox) throw new Error('Mailbox not found');

      if (!mailbox.microsoft_graph_token) {
        throw new Error('Microsoft Graph token not found for this mailbox');
      }

      // Get tenant_id for the binding
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user!.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Parse Microsoft Graph token
      const graphToken = JSON.parse(mailbox.microsoft_graph_token);

      // Use the N8N workflow cloner to create the workflow
      await workflowCloner.cloneWorkflowForMailbox({
        mailboxId: mailbox.id,
        emailAddress: mailbox.email_address,
        displayName: mailbox.display_name,
        tenantId: profile.tenant_id,
        microsoftGraphToken: graphToken,
      });

      toast.success(`Workflow created successfully for ${mailbox.display_name}`);
      await loadData(); // Refresh the data

    } catch (error) {
      console.error('Error cloning workflow:', error);
      toast.error(`Failed to create workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleWorkflow = async (bindingId: string, isActive: boolean) => {
    try {
      setActionLoading(bindingId);

      const binding = bindings.find(b => b.id === bindingId);
      if (!binding) throw new Error('Binding not found');

      // Toggle the workflow in N8N
      if (isActive) {
        await workflowCloner.deactivateWorkflow(binding.n8n_workflow_id);
      } else {
        await workflowCloner.activateWorkflow(binding.n8n_workflow_id);
      }

      // Update the binding in the database
      const { error } = await supabase
        .from('n8n_bindings')
        .update({ 
          is_active: !isActive,
          last_synced_at: new Date().toISOString()
        })
        .eq('id', bindingId);

      if (error) throw error;

      toast.success(`Workflow ${!isActive ? 'activated' : 'deactivated'} successfully`);
      await loadData(); // Refresh the data

    } catch (error) {
      console.error('Error toggling workflow:', error);
      toast.error(`Failed to ${!isActive ? 'activate' : 'deactivate'} workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading workflows...</p>
        </div>
      </div>
    );
  }

  const mailboxesWithoutWorkflows = mailboxes.filter(m => 
    m.status === 'connected' && !bindings.some(b => b.mailbox_id === m.id)
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Workflow Management
        </h1>
        <p className="text-muted-foreground">
          Manage N8N workflows for your connected mailboxes
        </p>
      </div>

      <div className="grid gap-6">
        {/* Mailboxes without workflows */}
        {mailboxesWithoutWorkflows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Mailboxes Pending Workflow Setup
              </CardTitle>
              <CardDescription>
                These mailboxes need workflows to be cloned and configured
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mailboxesWithoutWorkflows.map((mailbox) => (
                  <div key={mailbox.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">{mailbox.display_name}</h3>
                      <p className="text-sm text-muted-foreground">{mailbox.email_address}</p>
                    </div>
                    <Button
                      onClick={() => cloneWorkflowForMailbox(mailbox.id)}
                      disabled={actionLoading === mailbox.id}
                      className="flex items-center gap-2"
                    >
                      {actionLoading === mailbox.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {actionLoading === mailbox.id ? 'Creating...' : 'Create Workflow'}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active workflows */}
        <Card>
          <CardHeader>
            <CardTitle>Active Workflows</CardTitle>
            <CardDescription>
              Manage and monitor your mailbox workflows
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bindings.length === 0 ? (
              <div className="text-center py-8">
                <Settings className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No workflows configured</h3>
                <p className="mt-2 text-muted-foreground">
                  Connect a mailbox and create a workflow to get started
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mailbox</TableHead>
                    <TableHead>Workflow Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bindings.map((binding) => {
                    const mailbox = mailboxes.find(m => m.id === binding.mailbox_id);
                    return (
                      <TableRow key={binding.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{mailbox?.display_name || 'Unknown'}</div>
                            <div className="text-sm text-muted-foreground">
                              {mailbox?.email_address || 'Unknown'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{binding.workflow_name}</div>
                          <div className="text-sm text-muted-foreground">
                            ID: {binding.n8n_workflow_id}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={binding.is_active ? 'default' : 'secondary'}>
                            {binding.is_active ? 'Active' : 'Paused'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {binding.last_synced_at ? (
                            <div className="text-sm">
                              {new Date(binding.last_synced_at).toLocaleString()}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Never</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={binding.is_active}
                              onCheckedChange={() => toggleWorkflow(binding.id, binding.is_active)}
                              disabled={actionLoading === binding.id}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`https://agent.lyfeai.com.au/workflow/${binding.n8n_workflow_id}`, '_blank')}
                              className="flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Open in N8N
                            </Button>
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
    </div>
  );
}