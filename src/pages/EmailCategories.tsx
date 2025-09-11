import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Tag, ArrowLeft, Loader2, Settings, Download } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

interface EmailCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  priority: number;
  is_active: boolean;
  created_at: string;
}

interface ClassificationRule {
  id: string;
  category_id: string;
  name: string;
  rule_type: 'sender' | 'subject' | 'content' | 'domain' | 'ai';
  rule_value: string;
  priority: number;
  is_active: boolean;
  category_name?: string;
  category_color?: string;
}

export default function EmailCategories() {
  const { user } = useAuth();
  const location = useLocation();
  const [categories, setCategories] = useState<EmailCategory[]>([]);
  const [rules, setRules] = useState<ClassificationRule[]>([]);
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EmailCategory | null>(null);
  const [editingRule, setEditingRule] = useState<ClassificationRule | null>(null);

  // Category form state
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    priority: 50,
    is_active: true
  });

  // Rule form state
  const [ruleForm, setRuleForm] = useState({
    name: '',
    category_id: '',
    rule_type: 'sender' as ClassificationRule['rule_type'],
    rule_value: '',
    priority: 50,
    is_active: true
  });

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user, selectedMailbox]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load mailboxes
      const { data: mailboxesData, error: mailboxesError } = await supabase
        .from('mailboxes')
        .select('id, email_address, display_name, status')
        .eq('status', 'connected')
        .order('email_address');

      if (mailboxesError) throw mailboxesError;
      setMailboxes(mailboxesData || []);

      // Set first mailbox as default if none selected
      if (!selectedMailbox && mailboxesData && mailboxesData.length > 0) {
        setSelectedMailbox(mailboxesData[0].id);
        return; // This will trigger useEffect again with the selected mailbox
      }

      // Load categories for selected mailbox (global + mailbox-specific)
      let categoriesQuery = supabase
        .from('email_categories')
        .select('*');

      if (selectedMailbox) {
        categoriesQuery = categoriesQuery.or(`mailbox_id.eq.${selectedMailbox},mailbox_id.is.null`);
      } else {
        categoriesQuery = categoriesQuery.is('mailbox_id', null);
      }

      categoriesQuery = categoriesQuery.order('priority', { ascending: false });

      const { data: categoriesData, error: categoriesError } = await categoriesQuery;

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Load rules with category info
      const { data: rulesData, error: rulesError } = await supabase
        .from('email_classification_rules')
        .select(`
          *,
          email_categories(name, color)
        `)
        .order('priority', { ascending: false });

      if (rulesError) throw rulesError;
      
      const processedRules: ClassificationRule[] = rulesData?.map(rule => ({
        id: rule.id,
        category_id: rule.category_id,
        name: rule.name,
        rule_type: rule.rule_type as ClassificationRule['rule_type'],
        rule_value: rule.rule_value,
        priority: rule.priority || 0,
        is_active: rule.is_active || false,
        category_name: rule.email_categories?.name,
        category_color: rule.email_categories?.color
      })) || [];
      
      setRules(processedRules);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load email categories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user!.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const categoryData = {
        ...categoryForm,
        user_id: user!.id,
        tenant_id: profile.tenant_id,
        mailbox_id: selectedMailbox || null // Associate with selected mailbox or make it global
      };

      const { error } = await supabase
        .from('email_categories')
        .insert(categoryData);

      if (error) throw error;

      toast.success('Category created successfully');
      setDialogOpen(false);
      resetCategoryForm();
      loadData();
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error('Failed to create category');
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory) return;

    try {
      const { error } = await supabase
        .from('email_categories')
        .update(categoryForm)
        .eq('id', editingCategory.id);

      if (error) throw error;

      toast.success('Category updated successfully');
      setDialogOpen(false);
      setEditingCategory(null);
      resetCategoryForm();
      loadData();
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error('Failed to update category');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category? This will also delete all associated rules.')) return;

    try {
      const { error } = await supabase
        .from('email_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      toast.success('Category deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Failed to delete category');
    }
  };

  const handleCreateRule = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user!.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const { error } = await supabase
        .from('email_classification_rules')
        .insert({
          ...ruleForm,
          user_id: user!.id,
          tenant_id: profile.tenant_id
        });

      if (error) throw error;

      toast.success('Rule created successfully');
      setRuleDialogOpen(false);
      resetRuleForm();
      loadData();
    } catch (error) {
      console.error('Error creating rule:', error);
      toast.error('Failed to create rule');
    }
  };

  const handleUpdateRule = async () => {
    if (!editingRule) return;

    try {
      const { error } = await supabase
        .from('email_classification_rules')
        .update(ruleForm)
        .eq('id', editingRule.id);

      if (error) throw error;

      toast.success('Rule updated successfully');
      setRuleDialogOpen(false);
      setEditingRule(null);
      resetRuleForm();
      loadData();
    } catch (error) {
      console.error('Error updating rule:', error);
      toast.error('Failed to update rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      const { error } = await supabase
        .from('email_classification_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      toast.success('Rule deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete rule');
    }
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      description: '',
      color: '#3b82f6',
      priority: 50,
      is_active: true
    });
  };

  const resetRuleForm = () => {
    setRuleForm({
      name: '',
      category_id: '',
      rule_type: 'sender',
      rule_value: '',
      priority: 50,
      is_active: true
    });
  };

  const openCategoryDialog = (category?: EmailCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || '',
        color: category.color,
        priority: category.priority,
        is_active: category.is_active
      });
    } else {
      setEditingCategory(null);
      resetCategoryForm();
    }
    setDialogOpen(true);
  };

  const openRuleDialog = (rule?: ClassificationRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleForm({
        name: rule.name,
        category_id: rule.category_id,
        rule_type: rule.rule_type,
        rule_value: rule.rule_value,
        priority: rule.priority,
        is_active: rule.is_active
      });
    } else {
      setEditingRule(null);
      resetRuleForm();
    }
    setRuleDialogOpen(true);
  };

  const handleSyncCategories = async () => {
    let mailboxId = selectedMailbox;
    
    // If in mailbox context, extract from URL
    if (!mailboxId) {
      const pathParts = location.pathname.split('/');
      if (pathParts[1] === 'mailbox') {
        mailboxId = pathParts[2];
      }
    }

    if (!mailboxId) {
      toast.error('Please select a mailbox to sync from');
      return;
    }

    try {
      setSyncing(true);
      console.log('Starting sync for mailbox:', mailboxId);

      const response = await supabase.functions.invoke('sync-mailbox-categories', {
        body: { mailboxId }
      });

      console.log('Supabase function response:', response);

      if (response.error) {
        console.error('Function error:', response.error);
        throw new Error(response.error.message || 'Failed to sync categories');
      }

      const result = response.data;
      console.log('Sync result:', result);
      toast.success(`${result.imported} categories imported successfully`);
      loadData(); // Refresh the categories list
    } catch (error) {
      console.error('Error syncing categories:', error);
      toast.error(`Failed to sync categories: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // Show sync functionality if mailboxes are available
  const showSyncOption = mailboxes.length > 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading email categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/settings">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Tag className="h-6 w-6" />
          Email Categories & Classification
        </h1>
        <p className="text-muted-foreground">
          Manage email categories and automatic classification rules for each mailbox
        </p>
        {selectedMailbox && mailboxes.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              Currently viewing: {mailboxes.find(m => m.id === selectedMailbox)?.display_name || 
                                 mailboxes.find(m => m.id === selectedMailbox)?.email_address}
            </Badge>
          </div>
        )}
      </div>

      <div className="grid gap-6">
        {/* Categories Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Email Categories</CardTitle>
                <CardDescription>
                  Define categories for automatic email classification
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                {showSyncOption && (
                  <div className="flex gap-2">
                    <Select value={selectedMailbox} onValueChange={setSelectedMailbox}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select mailbox to sync" />
                      </SelectTrigger>
                      <SelectContent>
                        {mailboxes.map((mailbox) => (
                          <SelectItem key={mailbox.id} value={mailbox.id}>
                            {mailbox.display_name || mailbox.email_address}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleSyncCategories} 
                      variant="outline" 
                      className="gap-2"
                      disabled={syncing || !selectedMailbox}
                    >
                      {syncing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {syncing ? 'Syncing...' : 'Sync Categories'}
                    </Button>
                  </div>
                )}
                <Button onClick={() => openCategoryDialog()} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Category
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <div className="text-center py-8">
                <Tag className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No categories defined</h3>
                <p className="mt-2 text-muted-foreground">
                  Create categories to automatically classify your emails
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="font-medium">{category.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{category.description || '-'}</TableCell>
                      <TableCell>{category.priority}</TableCell>
                      <TableCell>
                        <Badge variant={category.is_active ? 'default' : 'secondary'}>
                          {category.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCategoryDialog(category)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCategory(category.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Classification Rules Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Classification Rules</CardTitle>
                <CardDescription>
                  Define rules to automatically assign categories to emails
                </CardDescription>
              </div>
              <Button onClick={() => openRuleDialog()} className="gap-2" disabled={categories.length === 0}>
                <Plus className="h-4 w-4" />
                Add Rule
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <div className="text-center py-8">
                <Settings className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No rules defined</h3>
                <p className="mt-2 text-muted-foreground">
                  Create rules to automatically classify emails into categories
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: rule.category_color }}
                          />
                          <span>{rule.category_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rule.rule_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{rule.rule_value}</TableCell>
                      <TableCell>{rule.priority}</TableCell>
                      <TableCell>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRuleDialog(rule)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Create Category'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory ? 'Update the category details' : 'Create a new email category for classification'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="e.g., Important, Spam, Marketing"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Describe what emails belong in this category"
              />
            </div>
            <div>
              <Label htmlFor="color">Colour</Label>
              <Input
                id="color"
                type="color"
                value={categoryForm.color}
                onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority (0-100)</Label>
              <Input
                id="priority"
                type="number"
                min="0"
                max="100"
                value={categoryForm.priority}
                onChange={(e) => setCategoryForm({ ...categoryForm, priority: parseInt(e.target.value) })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={categoryForm.is_active}
                onCheckedChange={(checked) => setCategoryForm({ ...categoryForm, is_active: checked })}
              />
              <Label htmlFor="active">Active</Label>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={editingCategory ? handleUpdateCategory : handleCreateCategory}
                className="flex-1"
              >
                {editingCategory ? 'Update' : 'Create'}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Edit Rule' : 'Create Classification Rule'}
            </DialogTitle>
            <DialogDescription>
              {editingRule ? 'Update the rule details' : 'Create a new rule to automatically classify emails'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input
                id="rule-name"
                value={ruleForm.name}
                onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                placeholder="e.g., Marketing Emails, Boss Communications"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={ruleForm.category_id} onValueChange={(value) => setRuleForm({ ...ruleForm, category_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rule-type">Rule Type</Label>
              <Select value={ruleForm.rule_type} onValueChange={(value: ClassificationRule['rule_type']) => setRuleForm({ ...ruleForm, rule_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sender">Sender Email</SelectItem>
                  <SelectItem value="domain">Domain</SelectItem>
                  <SelectItem value="subject">Subject Contains</SelectItem>
                  <SelectItem value="content">Content Contains</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rule-value">Rule Value</Label>
              <Input
                id="rule-value"
                value={ruleForm.rule_value}
                onChange={(e) => setRuleForm({ ...ruleForm, rule_value: e.target.value })}
                placeholder={
                  ruleForm.rule_type === 'sender' ? 'sender@example.com' :
                  ruleForm.rule_type === 'domain' ? 'example.com' :
                  ruleForm.rule_type === 'subject' ? 'keyword' :
                  'keyword or phrase'
                }
              />
            </div>
            <div>
              <Label htmlFor="rule-priority">Priority (0-100)</Label>
              <Input
                id="rule-priority"
                type="number"
                min="0"
                max="100"
                value={ruleForm.priority}
                onChange={(e) => setRuleForm({ ...ruleForm, priority: parseInt(e.target.value) })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="rule-active"
                checked={ruleForm.is_active}
                onCheckedChange={(checked) => setRuleForm({ ...ruleForm, is_active: checked })}
              />
              <Label htmlFor="rule-active">Active</Label>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={editingRule ? handleUpdateRule : handleCreateRule}
                className="flex-1"
              >
                {editingRule ? 'Update' : 'Create'}
              </Button>
              <Button variant="outline" onClick={() => setRuleDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}