import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Star, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface VipEmail {
  id: string;
  email_address: string;
  display_name: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface VipEmailManagementProps {
  mailboxId?: string;
}

export function VipEmailManagement({ mailboxId }: VipEmailManagementProps) {
  const { user } = useAuth();
  const [vipEmails, setVipEmails] = useState<VipEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (user) {
      loadVipEmails();
    }
  }, [user]);

  const loadVipEmails = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get user's tenant_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Fetch VIP email addresses for this tenant
      const { data, error } = await supabase
        .from('vip_email_addresses')
        .select('*')
        .eq('tenant_id', profileData.tenant_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setVipEmails(data || []);
    } catch (error) {
      console.error('Error loading VIP emails:', error);
      toast.error('Failed to load VIP emails');
    } finally {
      setLoading(false);
    }
  };

  const addVipEmail = async () => {
    if (!user || !newEmail.trim()) {
      toast.error('Email address is required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setSaving(true);

      // Get user's tenant_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      // Check if VIP email already exists
      const { data: existingVip } = await supabase
        .from('vip_email_addresses')
        .select('id')
        .eq('tenant_id', profileData.tenant_id)
        .eq('email_address', newEmail.trim().toLowerCase())
        .eq('is_active', true)
        .single();

      if (existingVip) {
        toast.error('This email address is already in your VIP list');
        return;
      }

      // Add new VIP email
      const { error } = await supabase
        .from('vip_email_addresses')
        .insert({
          tenant_id: profileData.tenant_id,
          user_id: user.id,
          email_address: newEmail.trim().toLowerCase(),
          display_name: newDisplayName.trim() || null,
          notes: newNotes.trim() || null,
          is_active: true
        });

      if (error) throw error;

      // Automatically trigger VIP processing in background
      try {
        console.log('Triggering automatic VIP processing...');
        
        await supabase.functions.invoke('update-vip-status', {
          body: {
            action: 'add',
            email_address: newEmail.trim().toLowerCase(),
            tenant_id: profileData.tenant_id
          }
        });

        console.log('Automatic VIP processing completed');
      } catch (outlookError) {
        console.error('Background VIP processing error:', outlookError);
        // Don't show error to user - this is background processing
      }

      
      // Clear form and reload list
      setNewEmail('');
      setNewDisplayName('');
      setNewNotes('');
      setShowAddForm(false);
      await loadVipEmails();
      
    } catch (error) {
      console.error('Error adding VIP email:', error);
      toast.error('Failed to add VIP email');
    } finally {
      setSaving(false);
    }
  };

  const removeVipEmail = async (vipId: string, emailAddress: string) => {
    try {
      // Get user's tenant_id first
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      const { error } = await supabase
        .from('vip_email_addresses')
        .update({ is_active: false })
        .eq('id', vipId);

      if (error) throw error;

      // Call the edge function to update Outlook mailboxes
      try {
        const { error: updateError } = await supabase.functions.invoke('update-vip-status', {
          body: {
            action: 'remove',
            email_address: emailAddress.toLowerCase(),
            tenant_id: profileData.tenant_id
          }
        });

        if (updateError) {
          console.error('Error updating Outlook VIP status:', updateError);
          toast.warning('VIP email removed, but there was an issue updating your Outlook mailbox.');
        } else {
          toast.success('VIP email removed and Outlook mailbox updated! The "VIP Important" category has been removed from existing emails.');
        }
      } catch (outlookError) {
        console.error('Error calling VIP update function:', outlookError);
        toast.warning('VIP email removed, but Outlook integration encountered an issue.');
      }

      await loadVipEmails();
    } catch (error) {
      console.error('Error removing VIP email:', error);
      toast.error('Failed to remove VIP email');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            VIP Email Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading VIP emails...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          VIP Email Management
        </CardTitle>
        <CardDescription>
          Add important email addresses that will be highlighted directly in your Outlook mailbox. VIP emails get a gold "VIP Important" category and high importance flag, making them impossible to miss.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* VIP List */}
        <div className="space-y-3">
          {vipEmails.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No VIP emails added yet</p>
              <p className="text-sm">Add important email addresses to highlight them</p>
            </div>
          ) : (
            vipEmails.map((vip) => (
              <div key={vip.id} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50/50 dark:bg-yellow-950/20">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">{vip.display_name || vip.email_address}</span>
                    <Badge variant="secondary" className="text-xs">VIP</Badge>
                  </div>
                  {vip.display_name && (
                    <p className="text-sm text-muted-foreground ml-6">{vip.email_address}</p>
                  )}
                  {vip.notes && (
                    <p className="text-xs text-muted-foreground ml-6 mt-1">{vip.notes}</p>
                  )}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove VIP Email</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove "{vip.display_name || vip.email_address}" from your VIP list? 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => removeVipEmail(vip.id, vip.email_address)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          )}
        </div>

        {/* Add VIP Form */}
        {showAddForm ? (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <div className="space-y-2">
              <Label htmlFor="vip-email">Email Address *</Label>
              <Input
                id="vip-email"
                type="email"
                placeholder="Enter VIP email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vip-display-name">Display Name</Label>
              <Input
                id="vip-display-name"
                placeholder="Enter display name (optional)"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vip-notes">Notes</Label>
              <Textarea
                id="vip-notes"
                placeholder="Add notes about this VIP contact (optional)"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={addVipEmail} disabled={saving || !newEmail.trim()}>
                {saving ? 'Adding...' : 'Add VIP Email'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddForm(false);
                  setNewEmail('');
                  setNewDisplayName('');
                  setNewNotes('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={() => setShowAddForm(true)} className="w-full" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add VIP Email
          </Button>
        )}

        <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted/30 rounded-lg">
          <p className="font-medium mb-1">How VIP emails work in Outlook:</p>
          <ul className="space-y-1">
            <li>• VIP emails get a gold "VIP Important" category directly in Outlook</li>
            <li>• High importance flag makes them stand out in your inbox</li>
            <li>• Existing emails from VIP senders are automatically updated</li>
            <li>• New emails are processed automatically as they arrive</li>
            <li>• Works across all your devices where Outlook is signed in</li>
          </ul>
          
          {/* Test Button */}
          <div className="mt-3 pt-3 border-t border-muted">
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!user) return;
                  
                  const { data: profileData } = await supabase
                    .from('profiles')
                    .select('tenant_id')
                    .eq('id', user.id)
                    .single();
                  
                  if (!profileData) return;
                  
                  toast.promise(
                    supabase.functions.invoke('update-vip-status', {
                      body: {
                        action: 'process_mailbox',
                        mailbox_id: null, // Will find all mailboxes
                        tenant_id: profileData.tenant_id
                      }
                    }),
                    {
                      loading: 'Updating Outlook mailbox with VIP categories...',
                      success: 'Outlook mailbox updated! Check your emails for gold "VIP Important" categories.',
                      error: 'Failed to update Outlook mailbox. Check the function logs.'
                    }
                  );
                }}
                className="text-xs"
              >
                🔄 Update Outlook Now
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  toast.promise(
                    supabase.functions.invoke('ensure-vip-categories', {}),
                    {
                      loading: 'Ensuring VIP categories exist for all users...',
                      success: (result) => {
                        const data = result.data;
                        return `VIP categories checked! ${data.results?.filter((r: any) => r.success).length || 'All'} mailboxes processed successfully.`;
                      },
                      error: 'Failed to ensure VIP categories. Check the function logs.'
                    }
                  );
                }}
                className="text-xs"
              >
                🏷️ Ensure VIP Categories
              </Button>
            </div>
            <div className="space-y-1 mt-2">
              <p className="text-xs text-muted-foreground">
                <strong>Update Outlook Now:</strong> Manually applies VIP categories to all existing emails in your mailbox
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Ensure VIP Categories:</strong> Creates the "VIP Important" category in all connected Outlook mailboxes
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}