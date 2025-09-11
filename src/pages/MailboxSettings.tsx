import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Settings, Mail, Shield, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface MailboxConfig {
  id: string;
  mailbox_id: string;
  version: number;
  config: any; // Using any for JSONB fields for simplicity
  is_active: boolean;
}

interface Mailbox {
  id: string;
  email_address: string;
  display_name: string;
  status: 'pending' | 'connected' | 'error' | 'paused';
  error_message: string | null;
  last_sync_at: string | null;
}

export default function MailboxSettings() {
  const { mailboxId } = useParams<{ mailboxId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mailbox, setMailbox] = useState<Mailbox | null>(null);
  const [config, setConfig] = useState<MailboxConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reAuthenticating, setReAuthenticating] = useState(false);
  const [globalQuarantineEnabled, setGlobalQuarantineEnabled] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<any>(null);

  // Config form state
  const [monitoredFolders, setMonitoredFolders] = useState<string[]>(['Inbox']);
  const [categoryEnabled, setCategoryEnabled] = useState(true);
  const [quarantineEnabled, setQuarantineEnabled] = useState(true);
  const [autoResponseEnabled, setAutoResponseEnabled] = useState(false);
  const [syncFrequency, setSyncFrequency] = useState(5);
  const [customRules, setCustomRules] = useState('');

  useEffect(() => {
    if (!user || !mailboxId) return;
    loadMailboxAndConfig();
  }, [user, mailboxId]);

  const loadMailboxAndConfig = async () => {
    try {
      setLoading(true);

      // Load global quarantine settings first
      const { data: globalQuarantineData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'quarantine_config')
        .single();

      if (globalQuarantineData) {
        const quarantineConfig = globalQuarantineData.value as any;
        setGlobalQuarantineEnabled(quarantineConfig.enabled || false);
      }

      // Load mailbox
      const { data: mailboxData, error: mailboxError } = await supabase
        .from('mailboxes')
        .select('*')
        .eq('id', mailboxId)
        .single();

      if (mailboxError) throw mailboxError;
      setMailbox(mailboxData);

      // Load polling status
      const { data: pollingData } = await supabase
        .from('email_polling_status')
        .select('*')
        .eq('mailbox_id', mailboxId)
        .maybeSingle();

      setPollingStatus(pollingData);

      // Load current config (use maybeSingle since config might not exist yet)
      const { data: configData, error: configError } = await supabase
        .from('mailbox_configs')
        .select('*')
        .eq('mailbox_id', mailboxId)
        .eq('is_active', true)
        .maybeSingle();

      if (configError) {
        console.error('Error loading config:', configError);
        // Don't throw here - we can continue without existing config
      }

      if (configData) {
        setConfig(configData);
        // Populate form with existing config
        const cfg = configData.config as any;
        setMonitoredFolders(cfg?.monitored_folders || ['Inbox']);
        setCategoryEnabled(cfg?.category_enabled ?? true);
        setQuarantineEnabled(cfg?.quarantine_enabled ?? true);
        setAutoResponseEnabled(cfg?.auto_response_enabled ?? false);
        setSyncFrequency(cfg?.sync_frequency || 5);
        setCustomRules(JSON.stringify(cfg?.rules || [], null, 2));
      } else {
        // Set defaults when no config exists
        setConfig(null);
        setMonitoredFolders(['Inbox']);
        setCategoryEnabled(true);
        setQuarantineEnabled(globalQuarantineEnabled); // Respect global setting
        setAutoResponseEnabled(false);
        setSyncFrequency(5);
        setCustomRules('[]');
      }
    } catch (error) {
      console.error('Error loading mailbox settings:', error);
      toast.error('Failed to load mailbox settings');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!mailbox) return;

    try {
      setSaving(true);

      let rules = [];
      try {
        if (customRules.trim()) {
          rules = JSON.parse(customRules);
          // Validate that it's an array
          if (!Array.isArray(rules)) {
            toast.error('Custom rules must be a JSON array');
            return;
          }
        }
      } catch (e) {
        toast.error('Invalid JSON in custom rules');
        return;
      }

      const newConfig = {
        monitored_folders: monitoredFolders.filter(folder => folder.trim() !== ''),
        category_enabled: categoryEnabled,
        quarantine_enabled: quarantineEnabled && globalQuarantineEnabled, // Only enable if global is enabled
        auto_response_enabled: autoResponseEnabled,
        sync_frequency: syncFrequency,
        rules
      };

      // Get user's tenant_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user!.id)
        .single();

      if (profileError) throw profileError;

      // Deactivate current config if it exists
      if (config) {
        await supabase
          .from('mailbox_configs')
          .update({ is_active: false })
          .eq('id', config.id);
      }

      // Create new config version
      const { error: insertError } = await supabase
        .from('mailbox_configs')
        .insert({
          mailbox_id: mailbox.id,
          tenant_id: profileData.tenant_id,
          version: (config?.version || 0) + 1,
          config: newConfig,
          is_active: true
        });

      if (insertError) throw insertError;

      // Update the email polling status with new sync frequency
      if (mailbox) {
        await supabase
          .from('email_polling_status')
          .upsert({
            tenant_id: profileData.tenant_id,
            mailbox_id: mailbox.id,
            polling_interval_minutes: syncFrequency,
            is_polling_active: true
          }, { 
            onConflict: 'tenant_id,mailbox_id',
            ignoreDuplicates: false 
          });
      }

      toast.success('Mailbox settings saved successfully');
      await loadMailboxAndConfig(); // Reload to get updated config
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addFolder = () => {
    setMonitoredFolders([...monitoredFolders, '']);
  };

  const updateFolder = (index: number, value: string) => {
    const updated = [...monitoredFolders];
    updated[index] = value;
    setMonitoredFolders(updated);
  };

  const removeFolder = (index: number) => {
    if (monitoredFolders.length > 1) {
      setMonitoredFolders(monitoredFolders.filter((_, i) => i !== index));
    } else {
      toast.error('At least one folder must be monitored');
    }
  };

  const handleReAuthenticate = async () => {
    if (!mailbox) return;

    try {
      setReAuthenticating(true);
      
      // Store the current page in localStorage so we can return here after auth
      // Use window.location.pathname to ensure we get the correct current URL
      const currentPath = window.location.pathname;
      console.log('MailboxSettings: Current path before re-auth:', currentPath);
      console.log('MailboxSettings: Current URL:', window.location.href);
      console.log('MailboxSettings: Mailbox ID:', mailbox.id);
      
      // Ensure we construct the path correctly
      const targetPath = `/mailbox/${mailbox.id}/settings`;
      console.log('MailboxSettings: Target path:', targetPath);
      console.log('MailboxSettings: Paths match:', currentPath === targetPath);
      
      localStorage.setItem('post_auth_redirect', targetPath);
      
      // Call the mailbox-api edge function to get a new auth URL
      const { data, error } = await supabase.functions.invoke('mailbox-api', {
        body: {
          emailAddress: mailbox.email_address,
          displayName: mailbox.display_name,
          preset: 'existing', // Indicate this is re-authentication
          mailboxId: mailbox.id
        },
      });

      if (error) {
        console.error('Re-authentication error:', error);
        throw new Error(error.message || "Failed to initiate re-authentication");
      }

      const { authUrl } = data;
      
      // Redirect to Microsoft OAuth for re-authentication
      window.location.href = authUrl;
    } catch (error) {
      console.error("Error during re-authentication:", error);
      toast.error(error instanceof Error ? error.message : "Failed to re-authenticate");
    } finally {
      setReAuthenticating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading mailbox settings...</p>
        </div>
      </div>
    );
  }

  if (!mailbox) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">Mailbox not found</h1>
          <p className="mt-2 text-muted-foreground">The requested mailbox could not be found.</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Mailbox Settings
          </h1>
          <p className="text-muted-foreground">
            Configure settings for {mailbox.display_name} ({mailbox.email_address})
          </p>
        </div>
        <Badge variant={mailbox.status === 'connected' ? 'default' : 'secondary'}>
          {mailbox.status}
        </Badge>
      </div>

      <div className="grid gap-6">
        {/* Mailbox Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Mailbox Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email Address</Label>
                <Input value={mailbox.email_address} disabled />
              </div>
              <div>
                <Label>Display Name</Label>
                <Input value={mailbox.display_name} disabled />
              </div>
            </div>
            {mailbox.last_sync_at && (
              <div>
                <Label>Last Sync</Label>
                <Input value={new Date(mailbox.last_sync_at).toLocaleString()} disabled />
              </div>
            )}
            {mailbox.error_message && (
              <div>
                <Label>Error Message</Label>
                <Textarea value={mailbox.error_message} disabled />
              </div>
            )}
            
            {/* Re-authentication section */}
            <div className="pt-4 border-t">
              <Label className="text-base">Authentication</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Re-authenticate if you're experiencing permission issues or after updating app permissions
              </p>
              <Button 
                variant="outline" 
                onClick={handleReAuthenticate}
                disabled={reAuthenticating}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${reAuthenticating ? 'animate-spin' : ''}`} />
                {reAuthenticating ? 'Re-authenticating...' : 'Re-authenticate with Microsoft'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Monitoring Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Email Monitoring
            </CardTitle>
            <CardDescription>
              Configure which folders to monitor and security features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Monitored Folders */}
            <div>
              <Label className="text-base">Monitored Folders</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Specify which email folders to monitor for threats
              </p>
              <div className="space-y-2">
                {monitoredFolders.map((folder, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={folder}
                      onChange={(e) => updateFolder(index, e.target.value)}
                      placeholder="Folder name (e.g., Inbox, Sent)"
                    />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeFolder(index)}
                  disabled={monitoredFolders.length === 1}
                >
                  Remove
                </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addFolder}>
                  Add Folder
                </Button>
              </div>
            </div>

            <Separator />

            {/* Security Features */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Category Classification</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically categorise emails based on content
                  </p>
                </div>
                <Switch
                  checked={categoryEnabled}
                  onCheckedChange={setCategoryEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Quarantine Suspicious Emails</Label>
                  <p className="text-sm text-muted-foreground">
                    {globalQuarantineEnabled 
                      ? "Move potentially harmful emails to quarantine for this mailbox"
                      : "Global quarantine system is disabled by administrator"
                    }
                  </p>
                </div>
                <Switch
                  checked={quarantineEnabled}
                  onCheckedChange={setQuarantineEnabled}
                  disabled={!globalQuarantineEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Auto-Response</Label>
                  <p className="text-sm text-muted-foreground">
                    Send automatic responses to flagged emails
                  </p>
                </div>
                <Switch
                  checked={autoResponseEnabled}
                  onCheckedChange={setAutoResponseEnabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Sync Settings
            </CardTitle>
            <CardDescription>
              Configure how often to check for new emails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Sync Frequency (minutes)</Label>
              <p className="text-sm text-muted-foreground mb-2">
                How often to check for new emails. Current setting: Every {syncFrequency} minute{syncFrequency !== 1 ? 's' : ''}
              </p>
              <Select value={syncFrequency.toString()} onValueChange={(value) => setSyncFrequency(parseInt(value))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Every minute</SelectItem>
                  <SelectItem value="5">Every 5 minutes</SelectItem>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="30">Every 30 minutes</SelectItem>
                  <SelectItem value="60">Every hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Polling Status Information */}
            {pollingStatus && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <Label className="text-sm font-medium">Polling Status</Label>
                <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <span className={`ml-2 ${pollingStatus.is_polling_active ? 'text-green-600' : 'text-red-600'}`}>
                      {pollingStatus.is_polling_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Interval:</span>
                    <span className="ml-2">{pollingStatus.polling_interval_minutes || 5} minutes</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Poll:</span>
                    <span className="ml-2">
                      {pollingStatus.last_poll_at 
                        ? new Date(pollingStatus.last_poll_at).toLocaleString()
                        : 'Never'
                      }
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Emails Processed:</span>
                    <span className="ml-2">{pollingStatus.total_emails_processed || 0}</span>
                  </div>
                  {pollingStatus.last_error_message && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Last Error:</span>
                      <span className="ml-2 text-red-600 text-xs">{pollingStatus.last_error_message}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom Rules */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Rules</CardTitle>
            <CardDescription>
              Define custom rules in JSON format for advanced email processing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={customRules}
              onChange={(e) => setCustomRules(e.target.value)}
              placeholder='Enter custom rules as JSON array, e.g.:\n[\n  {\n    "name": "Block suspicious domains",\n    "type": "sender_domain",\n    "value": "suspicious-site.com",\n    "action": "quarantine"\n  }\n]'
              className="min-h-[200px] font-mono"
            />
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate('/dashboard')}>
            Cancel
          </Button>
          <Button onClick={saveConfig} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}