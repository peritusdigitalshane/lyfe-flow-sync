import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Play, Pause, Copy, Settings } from 'lucide-react';
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

      // Create a new workflow by cloning the master template
      const workflowName = `${mailbox.display_name} - Email Security`;
      
      // This would call your N8N API to clone a master workflow
      // For now, we'll simulate creating a workflow
      const mockWorkflowId = `workflow_${Date.now()}`;
      const mockCredentialId = `cred_${Date.now()}`;

      // Get tenant_id for the binding
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user!.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Create n8n binding record
      const { error: bindingError } = await supabase
        .from('n8n_bindings')
        .insert({
          mailbox_id: mailboxId,
          n8n_workflow_id: mockWorkflowId,
          n8n_credential_id: mockCredentialId,
          workflow_name: workflowName,
          tenant_id: profile.tenant_id,
          is_active: true
        });

      if (bindingError) throw bindingError;

      // Update mailbox with workflow ID
      const { error: updateError } = await supabase
        .from('mailboxes')
        .update({ 
          n8n_workflow_id: mockWorkflowId,
          n8n_credential_id: mockCredentialId
        })
        .eq('id', mailboxId);

      if (updateError) throw updateError;

      toast.success('Workflow cloned successfully');
      await loadData();
    } catch (error) {
      console.error('Error cloning workflow:', error);
      toast.error('Failed to clone workflow');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleWorkflow = async (bindingId: string, isActive: boolean) => {
    try {
      setActionLoading(bindingId);

      const binding = bindings.find(b => b.id === bindingId);
      if (!binding) throw new Error('Binding not found');

      // Update binding status
      const { error: updateError } = await supabase
        .from('n8n_bindings')
        .update({ is_active: !isActive })
        .eq('id', bindingId);

      if (updateError) throw updateError;

      // Call N8N API to activate/deactivate workflow
      if (isActive) {
        await api.updateMailboxState(binding.mailbox_id, 'pause');
      } else {
        await api.updateMailboxState(binding.mailbox_id, 'resume');
      }

      toast.success(`Workflow ${isActive ? 'paused' : 'activated'} successfully`);
      await loadData();
    } catch (error) {
      console.error('Error toggling workflow:', error);
      toast.error('Failed to update workflow status');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
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
                      <Copy className="h-4 w-4" />
                      {actionLoading === mailbox.id ? 'Cloning...' : 'Clone Workflow'}
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
                  Connect a mailbox and clone a workflow to get started
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
                            >
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