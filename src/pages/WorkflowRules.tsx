import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Edit, Save, X, User, LogOut, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { WorkflowRule, WorkflowCondition, WorkflowAction } from "@/services/emailWorkflowEngine";

interface Category {
  id: string;
  name: string;
  color: string;
}

interface Mailbox {
  id: string;
  email_address: string;
  display_name: string;
}

interface MailboxFolder {
  id: string;
  displayName: string;
  parentFolderId?: string;
  wellKnownName?: string;
}

import { ImprovedNavigation } from "@/components/ImprovedNavigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function WorkflowRules() {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin } = useRoles();
  const { toast } = useToast();
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [folders, setFolders] = useState<MailboxFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loading, setLoading] = useState(true);
  const [suggestedRules, setSuggestedRules] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [newRule, setNewRule] = useState<Partial<WorkflowRule>>({
    name: '',
    conditions: [],
    actions: [],
    is_active: true,
    priority: 1
  });
  const [editingRuleData, setEditingRuleData] = useState<Partial<WorkflowRule>>({});

  useEffect(() => {
    if (!authLoading && user) {
      loadData();
      loadSuggestedRules(); // Load suggested rules on page load
    }
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading application...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    window.location.href = "/auth";
    return null;
  }

  const loadData = async () => {
    try {
      // Load workflow rules
      const { data: rulesData, error: rulesError } = await supabase
        .from('workflow_rules')
        .select('*')
        .order('priority', { ascending: false });

      if (rulesError) throw rulesError;

      // Convert JSON fields to proper types
      const convertedRules = (rulesData || []).map(rule => ({
        ...rule,
        conditions: Array.isArray(rule.conditions) ? rule.conditions as unknown as WorkflowCondition[] : [],
        actions: Array.isArray(rule.actions) ? rule.actions as unknown as WorkflowAction[] : []
      } as WorkflowRule));

      // Load categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('email_categories')
        .select('id, name, color')
        .eq('is_active', true);

      if (categoriesError) throw categoriesError;

      // Load mailboxes
      const { data: mailboxesData, error: mailboxesError } = await supabase
        .from('mailboxes')
        .select('id, email_address, display_name')
        .eq('status', 'connected');

      if (mailboxesError) throw mailboxesError;

      setRules(convertedRules);
      setCategories(categoriesData || []);
      setMailboxes(mailboxesData || []);
      
      // Load suggested rules after data is loaded, passing the actual rules data
      await loadSuggestedRules(convertedRules);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load workflow data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch available folders for a mailbox
  const fetchMailboxFolders = async (mailboxId: string) => {
    if (!mailboxId) {
      setFolders([]);
      return;
    }

    setLoadingFolders(true);
    try {
      console.log('Fetching folders for mailbox:', mailboxId);
      
      const response = await supabase.functions.invoke('get-mailbox-folders', {
        body: { mailbox_id: mailboxId }
      });

      if (response.error) {
        throw response.error;
      }

      if (response.data?.success) {
        setFolders(response.data.folders || []);
        console.log('Fetched folders:', response.data.folders);
      } else {
        throw new Error(response.data?.error || 'Failed to fetch folders');
      }
    } catch (error) {
      console.error('Error fetching folders:', error);
      toast({
        title: "Error",
        description: "Failed to fetch mailbox folders",
        variant: "destructive",
      });
      setFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  };

  const loadSuggestedRules = async (currentRules?: WorkflowRule[]) => {
    try {
      setLoadingSuggestions(true);
      console.log('Loading AI-powered suggested workflow rules...');
      
      const { data, error } = await supabase.functions.invoke('suggest-workflow-rules', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        console.error('Error loading suggestions:', error);
        throw error;
      }

      console.log('Loaded AI suggestions:', data);
      
      // Transform the suggestions to match the expected format
      const transformedSuggestions = (data.suggestions || []).map((suggestion: any) => ({
        id: `ai_${Date.now()}_${Math.random()}`,
        type: 'ai_smart_categorization',
        title: suggestion.name,
        description: suggestion.description,
        confidence: suggestion.confidence,
        suggestion_data: {
          ai_condition: suggestion.condition_text,
          action_type: 'categorise',
          category_name: suggestion.suggested_action.category_name,
          category_color: suggestion.suggested_action.category_color
        },
        email_examples: suggestion.email_examples || []
      }));

      setSuggestedRules(transformedSuggestions);
      
    } catch (error) {
      console.error('Error loading suggested rules:', error);
      toast({
        title: "Error",
        description: "Failed to load AI suggestions. Please try again later.",
        variant: "destructive",
      });
      setSuggestedRules([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const createRuleFromSuggestion = async (suggestion: any) => {
    try {
      // Get user's tenant_id first
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      let newRuleFromSuggestion: Partial<WorkflowRule> = {
        name: suggestion.title,
        conditions: [],
        actions: [],
        is_active: true,
        priority: 1
      };

      // Create conditions based on suggestion type
      if (suggestion.type === 'ai_smart_categorization' || suggestion.type.startsWith('ai_')) {
        // Handle AI-powered suggestions
        newRuleFromSuggestion.conditions = [{
          field: 'ai_analysis',
          operator: 'ai_condition',
          value: suggestion.suggestion_data.ai_condition,
          case_sensitive: false
        }];
      } else if (suggestion.type === 'sender_automation') {
        newRuleFromSuggestion.conditions = [{
          field: 'sender_email',
          operator: 'equals',
          value: suggestion.suggestion_data.sender_email,
          case_sensitive: false
        }];
      } else if (suggestion.type === 'subject_pattern') {
        newRuleFromSuggestion.conditions = [{
          field: 'subject',
          operator: 'contains',
          value: suggestion.suggestion_data.pattern,
          case_sensitive: false
        }];
      }

      // Handle actions based on suggestion data
      if (suggestion.suggestion_data.category_name) {
        // First, try to find existing category
        const existingCategory = categories.find(c => c.name === suggestion.suggestion_data.category_name);
        
        if (existingCategory) {
          newRuleFromSuggestion.actions = [{
            type: 'categorise',
            parameters: { category_id: existingCategory.id }
          }];
        } else {
          // Create new category
          const { data: newCategory, error: categoryError } = await supabase
            .from('email_categories')
            .insert({
              name: suggestion.suggestion_data.category_name,
              color: suggestion.suggestion_data.category_color || '#3b82f6',
              user_id: user?.id,
              tenant_id: profile?.tenant_id,
              is_active: true
            })
            .select()
            .single();

          if (categoryError) {
            console.error('Error creating category:', categoryError);
            throw categoryError;
          }

          newRuleFromSuggestion.actions = [{
            type: 'categorise',
            parameters: { category_id: newCategory.id }
          }];

          // Update categories list
          setCategories(prev => [...prev, newCategory]);
        }
      }

      // Set the new rule and open editor
      setNewRule(newRuleFromSuggestion);
      setEditingRule('new');
      
      // Remove the suggestion from the list
      setSuggestedRules(prev => prev.filter(s => s.title !== suggestion.title));
      
      toast({
        title: "Success",
        description: `Rule template "${suggestion.title}" loaded. Review and save when ready.`,
      });

    } catch (error) {
      console.error('Error creating rule from suggestion:', error);
      toast({
        title: "Error",
        description: "Failed to create rule from suggestion",
        variant: "destructive",
      });
    }
  };

  const saveRule = async (rule: Partial<WorkflowRule>) => {
    try {
      // Get user's tenant_id first
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      // Convert arrays to JSON for database storage
      const ruleData = {
        name: rule.name,
        tenant_id: profile.tenant_id, // Use the user's tenant_id
        mailbox_id: rule.mailbox_id,
        description: rule.description || null,
        conditions: rule.conditions as any,
        actions: rule.actions as any,
        is_active: rule.is_active,
        priority: rule.priority
      };

      if (rule.id) {
        // Update existing rule
        const { error } = await supabase
          .from('workflow_rules')
          .update(ruleData)
          .eq('id', rule.id);

        if (error) throw error;
      } else {
        // Create new rule
        const { error } = await supabase
          .from('workflow_rules')
          .insert(ruleData);

        if (error) throw error;
      }

      await loadData();
      setEditingRule(null);
      setNewRule({
        name: '',
        conditions: [],
        actions: [],
        is_active: true,
        priority: 1
      });

      toast({
        title: "Success",
        description: `Workflow rule ${rule.id ? 'updated' : 'created'} successfully`,
      });
    } catch (error) {
      console.error('Error saving rule:', error);
      toast({
        title: "Error",
        description: "Failed to save workflow rule",
        variant: "destructive",
      });
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm("Are you sure you want to delete this workflow rule?")) return;

    try {
      const { error } = await supabase
        .from('workflow_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      await loadData();
      toast({
        title: "Success",
        description: "Workflow rule deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        title: "Error",
        description: "Failed to delete workflow rule",
        variant: "destructive",
      });
    }
  };

  const toggleRuleStatus = async (ruleId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('workflow_rules')
        .update({ is_active: isActive })
        .eq('id', ruleId);

      if (error) throw error;

      await loadData();
      toast({
        title: "Success",
        description: `Workflow rule ${isActive ? 'enabled' : 'disabled'} successfully`,
      });
    } catch (error) {
      console.error('Error toggling rule status:', error);
      toast({
        title: "Error",
        description: "Failed to update rule status",
        variant: "destructive",
      });
    }
  };

  const addCondition = (rule: Partial<WorkflowRule>) => {
    const newCondition: WorkflowCondition = {
      field: 'subject',
      operator: 'contains',
      value: '',
      case_sensitive: false
    };

    const updatedRule = {
      ...rule,
      conditions: [...(rule.conditions || []), newCondition]
    };

    if (rule.id) {
      if (editingRule === rule.id) {
        setEditingRuleData(updatedRule);
      } else {
        setRules(rules.map(r => r.id === rule.id ? updatedRule as WorkflowRule : r));
      }
    } else {
      setNewRule(updatedRule);
    }
  };

  const addAICondition = (rule: Partial<WorkflowRule>) => {
    const newCondition: WorkflowCondition = {
      field: 'ai_analysis',
      operator: 'ai_condition',
      value: '',
      case_sensitive: false
    };

    const updatedRule = {
      ...rule,
      conditions: [...(rule.conditions || []), newCondition]
    };

    if (rule.id) {
      if (editingRule === rule.id) {
        setEditingRuleData(updatedRule);
      } else {
        setRules(rules.map(r => r.id === rule.id ? updatedRule as WorkflowRule : r));
      }
    } else {
      setNewRule(updatedRule);
    }
  };

  const addStandardCondition = (rule: Partial<WorkflowRule>, field: string) => {
    const newCondition: WorkflowCondition = {
      field: field as any,
      operator: 'contains',
      value: '',
      case_sensitive: false
    };

    const updatedRule = {
      ...rule,
      conditions: [...(rule.conditions || []), newCondition]
    };

    if (rule.id) {
      if (editingRule === rule.id) {
        setEditingRuleData(updatedRule);
      } else {
        setRules(rules.map(r => r.id === rule.id ? updatedRule as WorkflowRule : r));
      }
    } else {
      setNewRule(updatedRule);
    }
  };

  const addAction = (rule: Partial<WorkflowRule>) => {
    const newAction: WorkflowAction = {
      type: 'categorise',
      parameters: {}
    };

    const updatedRule = {
      ...rule,
      actions: [...(rule.actions || []), newAction]
    };

    if (rule.id) {
      if (editingRule === rule.id) {
        setEditingRuleData(updatedRule);
      } else {
        setRules(rules.map(r => r.id === rule.id ? updatedRule as WorkflowRule : r));
      }
    } else {
      setNewRule(updatedRule);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading workflow rules...</p>
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
            <h1 className="text-3xl font-bold">Workflow Rules</h1>
            <p className="text-muted-foreground mt-2">
              Create and manage automated email processing rules
            </p>
          </div>
          <Button 
            onClick={() => setEditingRule('new')} 
            variant="premium" 
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Rule
          </Button>
        </div>

        {/* Suggested Rules Section */}
        {suggestedRules.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Suggested Rules</span>
                {loadingSuggestions && <Loader2 className="h-4 w-4 animate-spin" />}
              </CardTitle>
              <CardDescription>
                Based on your email patterns, here are some automation opportunities that could save you time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {suggestedRules.map((suggestion, index) => (
                  <div key={index} className={`border rounded-lg p-4 ${suggestion.type.startsWith('ai_') ? 'bg-gradient-to-r from-primary/5 to-purple/5 border-primary/20' : 'bg-muted/30'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{suggestion.title}</h4>
                          {suggestion.type.startsWith('ai_') && (
                            <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/20">
                              AI Powered
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
                        <p className="text-xs text-primary mt-2 font-medium">{suggestion.impact}</p>
                        
                        {suggestion.type.startsWith('ai_') && suggestion.suggestion_data.ai_condition && (
                          <div className="mt-3 p-3 bg-background/50 border rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">AI Condition:</p>
                            <p className="text-xs font-mono bg-muted/50 px-2 py-1 rounded">
                              "{suggestion.suggestion_data.ai_condition}"
                            </p>
                          </div>
                        )}
                        
                        {suggestion.suggestion_data.examples && (
                          <div className="mt-3">
                            <p className="text-xs text-muted-foreground mb-1">
                              {suggestion.type.startsWith('ai_') ? 'Will detect emails like:' : 'Example subjects:'}
                            </p>
                            <div className="text-xs space-y-1">
                              {suggestion.suggestion_data.examples.slice(0, 3).map((example: string, i: number) => (
                                <div key={i} className="bg-background/50 px-2 py-1 rounded text-muted-foreground">
                                  • {example}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {suggestion.suggestion_data.sender_name && (
                          <div className="mt-2 text-xs">
                            <span className="text-muted-foreground">Sender: </span>
                            <span className="font-medium">{suggestion.suggestion_data.sender_name}</span>
                          </div>
                        )}

                        {suggestion.suggestion_data.category_name && (
                          <div className="mt-2 flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: suggestion.suggestion_data.category_color }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {suggestion.type.startsWith('ai_') ? 'Will categorize as:' : 'Most emails go to:'} {suggestion.suggestion_data.category_name}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <Button
                        variant={suggestion.type.startsWith('ai_') ? "premium" : "outline"}
                        size="sm"
                        onClick={() => createRuleFromSuggestion(suggestion)}
                        className="ml-4 gap-2"
                      >
                        <Plus className="h-3 w-3" />
                        Add Rule
                      </Button>
                    </div>
                  </div>
                 ))}
               </div>
            </CardContent>
          </Card>
        )}

        {/* New Rule Form */}
        {editingRule === 'new' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Create New Workflow Rule</CardTitle>
              <CardDescription>
                Define conditions and actions for automated email processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="rule-name">Rule Name</Label>
                  <Input
                    id="rule-name"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="Enter rule name"
                  />
                </div>
                <div>
                  <Label htmlFor="rule-priority">Priority</Label>
                  <Input
                    id="rule-priority"
                    type="number"
                    value={newRule.priority}
                    onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) })}
                    min="1"
                    max="100"
                  />
                </div>
              </div>

              <div>
                <Label>Apply to Mailbox</Label>
                <Select onValueChange={(value) => setNewRule({ ...newRule, mailbox_id: value === 'all' ? undefined : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select mailbox or apply to all" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Mailboxes</SelectItem>
                    {mailboxes.map((mailbox) => (
                      <SelectItem key={mailbox.id} value={mailbox.id}>
                        {mailbox.display_name} ({mailbox.email_address})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={newRule.is_active}
                  onCheckedChange={(checked) => setNewRule({ ...newRule, is_active: checked })}
                />
                <Label>Active</Label>
              </div>

              {/* Conditions Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium">Conditions</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addStandardCondition(newRule, 'subject')}
                      className="gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Standard Condition
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => addAICondition(newRule)}
                      className="gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add AI Condition
                    </Button>
                  </div>
                </div>
                
                {newRule.conditions && newRule.conditions.length > 0 ? (
                  <div className="space-y-2">
                    {newRule.conditions.map((condition, index) => (
                      <div key={index} className="border rounded-lg p-3 bg-muted/50">
                        {condition.field === 'ai_analysis' ? (
                          <div>
                            <Label className="text-xs text-muted-foreground">AI Condition</Label>
                            <div className="mt-1">
                              <Input
                                value={condition.value as string}
                                onChange={(e) => {
                                  const updatedConditions = [...(newRule.conditions || [])];
                                  updatedConditions[index] = { ...condition, value: e.target.value };
                                  setNewRule({ ...newRule, conditions: updatedConditions });
                                }}
                                placeholder="e.g., 'contains an urgent request' or 'appears to be spam'"
                                className="text-sm"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Describe the condition in natural language. AI will evaluate if emails match this description.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-4 gap-2">
                            <Select
                              value={condition.field}
                              onValueChange={(value) => {
                                const updatedConditions = [...(newRule.conditions || [])];
                                updatedConditions[index] = { ...condition, field: value as any };
                                setNewRule({ ...newRule, conditions: updatedConditions });
                              }}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="subject">Subject</SelectItem>
                                 <SelectItem value="sender_email">Sender Email</SelectItem>
                                 <SelectItem value="body_content">Body Content</SelectItem>
                                 <SelectItem value="has_attachments">Has Attachments</SelectItem>
                                 <SelectItem value="risk_score">Risk Score</SelectItem>
                                 <SelectItem value="category">Category</SelectItem>
                                 <SelectItem value="ai_analysis">AI Analysis</SelectItem>
                               </SelectContent>
                            </Select>
                            
                            <Select
                              value={condition.operator}
                              onValueChange={(value) => {
                                const updatedConditions = [...(newRule.conditions || [])];
                                updatedConditions[index] = { ...condition, operator: value as any };
                                setNewRule({ ...newRule, conditions: updatedConditions });
                              }}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contains">Contains</SelectItem>
                                <SelectItem value="equals">Equals</SelectItem>
                                <SelectItem value="not_equals">Not Equals</SelectItem>
                                <SelectItem value="starts_with">Starts With</SelectItem>
                                <SelectItem value="ends_with">Ends With</SelectItem>
                                <SelectItem value="greater_than">Greater Than</SelectItem>
                                <SelectItem value="less_than">Less Than</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <Input
                              value={condition.value as string}
                              onChange={(e) => {
                                const updatedConditions = [...(newRule.conditions || [])];
                                updatedConditions[index] = { ...condition, value: e.target.value };
                                setNewRule({ ...newRule, conditions: updatedConditions });
                              }}
                              placeholder="Value"
                              className="text-sm"
                            />
                            
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const updatedConditions = newRule.conditions?.filter((_, i) => i !== index) || [];
                                setNewRule({ ...newRule, conditions: updatedConditions });
                              }}
                              className="gap-1"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 border-2 border-dashed border-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">No conditions added yet</p>
                    <p className="text-xs text-muted-foreground">Add conditions to define when this rule should trigger</p>
                  </div>
                )}
              </div>

              {/* Actions Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium">Actions</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addAction(newRule)}
                    className="gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    Add Action
                  </Button>
                </div>
                
                {newRule.actions && newRule.actions.length > 0 ? (
                  <div className="space-y-2">
                    {newRule.actions.map((action, index) => (
                      <div key={index} className="border rounded-lg p-3 bg-muted/50">
                        <div className="grid grid-cols-3 gap-2">
                          <Select
                            value={action.type}
                            onValueChange={(value) => {
                              const updatedActions = [...(newRule.actions || [])];
                              updatedActions[index] = { ...action, type: value as any };
                              setNewRule({ ...newRule, actions: updatedActions });
                            }}
                          >
                            <SelectTrigger className="text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="categorise">Categorise</SelectItem>
                              <SelectItem value="quarantine">Quarantine</SelectItem>
                              <SelectItem value="move_to_folder">Move to Folder</SelectItem>
                              <SelectItem value="mark_as_read">Mark as Read</SelectItem>
                              <SelectItem value="send_notification">Send Notification</SelectItem>
                            </SelectContent>
                          </Select>
                          
                           {action.type === 'categorise' && (
                            <Select
                              value={action.parameters?.category_id || ''}
                              onValueChange={(value) => {
                                const updatedActions = [...(newRule.actions || [])];
                                updatedActions[index] = { 
                                  ...action, 
                                  parameters: { ...action.parameters, category_id: value }
                                };
                                setNewRule({ ...newRule, actions: updatedActions });
                              }}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((category) => (
                                  <SelectItem key={category.id} value={category.id}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          
                          {action.type === 'move_to_folder' && (
                            <div className="space-y-2">
                              <Select
                                value={action.parameters?.mailbox_id || ''}
                                onValueChange={(value) => {
                                  const updatedActions = [...(newRule.actions || [])];
                                  updatedActions[index] = { 
                                    ...action, 
                                    parameters: { ...action.parameters, mailbox_id: value, folder_id: '' }
                                  };
                                  setNewRule({ ...newRule, actions: updatedActions });
                                  fetchMailboxFolders(value);
                                }}
                              >
                                <SelectTrigger className="text-sm">
                                  <SelectValue placeholder="Select mailbox" />
                                </SelectTrigger>
                                <SelectContent>
                                  {mailboxes.map((mailbox) => (
                                    <SelectItem key={mailbox.id} value={mailbox.id}>
                                      {mailbox.display_name} ({mailbox.email_address})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              
                              {action.parameters?.mailbox_id && (
                                <Select
                                  value={action.parameters?.folder_id || ''}
                                  onValueChange={(value) => {
                                    const updatedActions = [...(newRule.actions || [])];
                                    updatedActions[index] = { 
                                      ...action, 
                                      parameters: { ...action.parameters, folder_id: value }
                                    };
                                    setNewRule({ ...newRule, actions: updatedActions });
                                  }}
                                  disabled={loadingFolders}
                                >
                                  <SelectTrigger className="text-sm">
                                    <SelectValue placeholder={loadingFolders ? "Loading folders..." : "Select folder"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {folders.map((folder) => (
                                      <SelectItem key={folder.id} value={folder.id}>
                                        {folder.displayName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          )}
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updatedActions = newRule.actions?.filter((_, i) => i !== index) || [];
                              setNewRule({ ...newRule, actions: updatedActions });
                            }}
                            className="gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 border-2 border-dashed border-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">No actions added yet</p>
                    <p className="text-xs text-muted-foreground">Add actions to define what happens when conditions are met</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={() => saveRule(newRule)} className="gap-2">
                  <Save className="h-4 w-4" />
                  Save Rule
                </Button>
                <Button onClick={() => setEditingRule(null)} variant="outline" className="gap-2">
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rules List */}
        <div className="space-y-4">
          {rules.map((rule) => (
            <Card key={rule.id} className="card-neon">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{rule.name}</CardTitle>
                    <CardDescription>
                      Priority: {rule.priority} | 
                      {rule.mailbox_id ? ` Mailbox: ${mailboxes.find(m => m.id === rule.mailbox_id)?.display_name || 'Unknown'}` : ' All Mailboxes'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => toggleRuleStatus(rule.id, checked)}
                    />
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => {
                         setEditingRule(rule.id);
                         setEditingRuleData(rule);
                       }}
                       className="gap-1"
                     >
                       <Edit className="h-3 w-3" />
                       Edit
                     </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteRule(rule.id)}
                      className="gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
               </CardHeader>
               <CardContent>
                 {editingRule === rule.id ? (
                   <div className="space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <Label htmlFor={`edit-rule-name-${rule.id}`}>Rule Name</Label>
                         <Input
                           id={`edit-rule-name-${rule.id}`}
                           value={editingRuleData.name || ''}
                           onChange={(e) => setEditingRuleData({ ...editingRuleData, name: e.target.value })}
                           placeholder="Enter rule name"
                         />
                       </div>
                       <div>
                         <Label htmlFor={`edit-rule-priority-${rule.id}`}>Priority</Label>
                         <Input
                           id={`edit-rule-priority-${rule.id}`}
                           type="number"
                           value={editingRuleData.priority || 1}
                           onChange={(e) => setEditingRuleData({ ...editingRuleData, priority: parseInt(e.target.value) })}
                           min="1"
                           max="100"
                         />
                       </div>
                     </div>

                     <div>
                       <Label>Apply to Mailbox</Label>
                       <Select 
                         value={editingRuleData.mailbox_id || 'all'} 
                         onValueChange={(value) => setEditingRuleData({ ...editingRuleData, mailbox_id: value === 'all' ? undefined : value })}
                       >
                         <SelectTrigger>
                           <SelectValue placeholder="Select mailbox or apply to all" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="all">All Mailboxes</SelectItem>
                           {mailboxes.map((mailbox) => (
                             <SelectItem key={mailbox.id} value={mailbox.id}>
                               {mailbox.display_name} ({mailbox.email_address})
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={editingRuleData.is_active || false}
                          onCheckedChange={(checked) => setEditingRuleData({ ...editingRuleData, is_active: checked })}
                        />
                        <Label>Active</Label>
                      </div>

                      {/* Conditions Section */}
                      <div>
                         <div className="flex items-center justify-between mb-3">
                           <Label className="text-sm font-medium">Conditions</Label>
                           <div className="flex gap-2">
                             <Button
                               type="button"
                               variant="outline"
                               size="sm"
                               onClick={() => addStandardCondition(editingRuleData, 'subject')}
                               className="gap-1"
                             >
                               <Plus className="h-3 w-3" />
                               Add Standard Condition
                             </Button>
                             <Button
                               type="button"
                               variant="secondary"
                               size="sm"
                               onClick={() => addAICondition(editingRuleData)}
                               className="gap-1"
                             >
                               <Plus className="h-3 w-3" />
                               Add AI Condition
                             </Button>
                           </div>
                         </div>
                        
                        {editingRuleData.conditions && editingRuleData.conditions.length > 0 ? (
                          <div className="space-y-2">
                            {editingRuleData.conditions.map((condition, index) => (
                              <div key={index} className="border rounded-lg p-3 bg-muted/50">
                                {condition.field === 'ai_analysis' ? (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">AI Condition</Label>
                                    <div className="mt-1">
                                      <Input
                                        value={condition.value as string}
                                        onChange={(e) => {
                                          const updatedConditions = [...(editingRuleData.conditions || [])];
                                          updatedConditions[index] = { ...condition, value: e.target.value };
                                          setEditingRuleData({ ...editingRuleData, conditions: updatedConditions });
                                        }}
                                        placeholder="e.g., 'contains an urgent request' or 'appears to be spam'"
                                        className="text-sm"
                                      />
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Describe the condition in natural language. AI will evaluate if emails match this description.
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-4 gap-2">
                                    <Select
                                      value={condition.field}
                                      onValueChange={(value) => {
                                        const updatedConditions = [...(editingRuleData.conditions || [])];
                                        updatedConditions[index] = { ...condition, field: value as any };
                                        setEditingRuleData({ ...editingRuleData, conditions: updatedConditions });
                                      }}
                                    >
                                      <SelectTrigger className="text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                       <SelectContent>
                                         <SelectItem value="subject">Subject</SelectItem>
                                         <SelectItem value="sender_email">Sender Email</SelectItem>
                                         <SelectItem value="body_content">Body Content</SelectItem>
                                         <SelectItem value="has_attachments">Has Attachments</SelectItem>
                                         <SelectItem value="risk_score">Risk Score</SelectItem>
                                         <SelectItem value="category">Category</SelectItem>
                                         <SelectItem value="ai_analysis">AI Analysis</SelectItem>
                                       </SelectContent>
                                    </Select>
                                    
                                    <Select
                                      value={condition.operator}
                                      onValueChange={(value) => {
                                        const updatedConditions = [...(editingRuleData.conditions || [])];
                                        updatedConditions[index] = { ...condition, operator: value as any };
                                        setEditingRuleData({ ...editingRuleData, conditions: updatedConditions });
                                      }}
                                    >
                                      <SelectTrigger className="text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="contains">Contains</SelectItem>
                                        <SelectItem value="equals">Equals</SelectItem>
                                        <SelectItem value="not_equals">Not Equals</SelectItem>
                                        <SelectItem value="starts_with">Starts With</SelectItem>
                                        <SelectItem value="ends_with">Ends With</SelectItem>
                                        <SelectItem value="greater_than">Greater Than</SelectItem>
                                        <SelectItem value="less_than">Less Than</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    
                                    <Input
                                      value={condition.value as string}
                                      onChange={(e) => {
                                        const updatedConditions = [...(editingRuleData.conditions || [])];
                                        updatedConditions[index] = { ...condition, value: e.target.value };
                                        setEditingRuleData({ ...editingRuleData, conditions: updatedConditions });
                                      }}
                                      placeholder="Enter value"
                                      className="text-sm"
                                    />
                                    
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const updatedConditions = editingRuleData.conditions?.filter((_, i) => i !== index) || [];
                                        setEditingRuleData({ ...editingRuleData, conditions: updatedConditions });
                                      }}
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                                {condition.field !== 'ai_analysis' && (
                                  <div className="flex items-center space-x-2 mt-2">
                                    <Switch
                                      checked={condition.case_sensitive}
                                      onCheckedChange={(checked) => {
                                        const updatedConditions = [...(editingRuleData.conditions || [])];
                                        updatedConditions[index] = { ...condition, case_sensitive: checked };
                                        setEditingRuleData({ ...editingRuleData, conditions: updatedConditions });
                                      }}
                                    />
                                    <Label className="text-xs">Case Sensitive</Label>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 border-2 border-dashed border-muted rounded-lg">
                            <p className="text-muted-foreground text-sm">No conditions defined</p>
                            <p className="text-muted-foreground text-xs mt-1">
                              Add conditions to specify when this rule should trigger
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Actions Section */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <Label className="text-sm font-medium">Actions</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addAction(editingRuleData)}
                            className="gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Add Action
                          </Button>
                        </div>
                        
                        {editingRuleData.actions && editingRuleData.actions.length > 0 ? (
                          <div className="space-y-2">
                            {editingRuleData.actions.map((action, index) => (
                              <div key={index} className="border rounded-lg p-3 bg-muted/50">
                                <div className="grid grid-cols-3 gap-2">
                                  <Select
                                    value={action.type}
                                    onValueChange={(value) => {
                                      const updatedActions = [...(editingRuleData.actions || [])];
                                      updatedActions[index] = { 
                                        ...action, 
                                        type: value as any,
                                        parameters: value === 'categorise' ? {} : action.parameters
                                      };
                                      setEditingRuleData({ ...editingRuleData, actions: updatedActions });
                                    }}
                                  >
                                    <SelectTrigger className="text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="categorise">Categorise Email</SelectItem>
                                      <SelectItem value="quarantine">Quarantine Email</SelectItem>
                                      <SelectItem value="move_to_folder">Move to Folder</SelectItem>
                                      <SelectItem value="mark_as_read">Mark as Read</SelectItem>
                                      <SelectItem value="send_notification">Send Notification</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  
                                  {action.type === 'categorise' && (
                                    <Select
                                      value={action.parameters?.category_id}
                                      onValueChange={(value) => {
                                        const updatedActions = [...(editingRuleData.actions || [])];
                                        updatedActions[index] = { 
                                          ...action, 
                                          parameters: { ...action.parameters, category_id: value }
                                        };
                                        setEditingRuleData({ ...editingRuleData, actions: updatedActions });
                                      }}
                                    >
                                      <SelectTrigger className="text-sm">
                                        <SelectValue placeholder="Select category" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {categories.map((category) => (
                                          <SelectItem key={category.id} value={category.id}>
                                            {category.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                  
                                  {action.type === 'move_to_folder' && (
                                    <div className="space-y-2">
                                      <Select
                                        value={action.parameters?.mailbox_id || ''}
                                        onValueChange={(value) => {
                                          const updatedActions = [...(editingRuleData.actions || [])];
                                          updatedActions[index] = { 
                                            ...action, 
                                            parameters: { ...action.parameters, mailbox_id: value, folder_id: '' }
                                          };
                                          setEditingRuleData({ ...editingRuleData, actions: updatedActions });
                                          fetchMailboxFolders(value);
                                        }}
                                      >
                                        <SelectTrigger className="text-sm">
                                          <SelectValue placeholder="Select mailbox" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {mailboxes.map((mailbox) => (
                                            <SelectItem key={mailbox.id} value={mailbox.id}>
                                              {mailbox.display_name} ({mailbox.email_address})
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      
                                      {action.parameters?.mailbox_id && (
                                        <Select
                                          value={action.parameters?.folder_id || ''}
                                          onValueChange={(value) => {
                                            const updatedActions = [...(editingRuleData.actions || [])];
                                            updatedActions[index] = { 
                                              ...action, 
                                              parameters: { ...action.parameters, folder_id: value }
                                            };
                                            setEditingRuleData({ ...editingRuleData, actions: updatedActions });
                                          }}
                                          disabled={loadingFolders}
                                        >
                                          <SelectTrigger className="text-sm">
                                            <SelectValue placeholder={loadingFolders ? "Loading folders..." : "Select folder"} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {folders.map((folder) => (
                                              <SelectItem key={folder.id} value={folder.id}>
                                                {folder.displayName}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      )}
                                    </div>
                                  )}
                                  
                                  {action.type === 'send_notification' && (
                                    <Input
                                      value={action.parameters?.message || ''}
                                      onChange={(e) => {
                                        const updatedActions = [...(editingRuleData.actions || [])];
                                        updatedActions[index] = { 
                                          ...action, 
                                          parameters: { ...action.parameters, message: e.target.value }
                                        };
                                        setEditingRuleData({ ...editingRuleData, actions: updatedActions });
                                      }}
                                      placeholder="Notification message"
                                      className="text-sm"
                                    />
                                  )}
                                  
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const updatedActions = editingRuleData.actions?.filter((_, i) => i !== index) || [];
                                      setEditingRuleData({ ...editingRuleData, actions: updatedActions });
                                    }}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 border-2 border-dashed border-muted rounded-lg">
                            <p className="text-muted-foreground text-sm">No actions defined</p>
                            <p className="text-muted-foreground text-xs mt-1">
                              Add actions to specify what should happen when conditions are met
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={() => saveRule(editingRuleData)} className="gap-2">
                          <Save className="h-4 w-4" />
                          Save Changes
                        </Button>
                        <Button onClick={() => setEditingRule(null)} variant="outline" className="gap-2">
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                   </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Conditions ({rule.conditions.length})</Label>
                         <div className="mt-2 space-y-1">
                           {rule.conditions.slice(0, 3).map((condition, index) => {
                             console.log(`RULE: ${rule.name} - Condition ${index}:`, condition);
                             console.log(`Field comparison: "${condition.field}" === "ai_analysis" = ${condition.field === 'ai_analysis'}`);
                             
                             return (
                               <div key={index} className="text-sm text-muted-foreground">
                                 {condition.field === 'ai_analysis' ? (
                                   <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded border-l-4 border-blue-500">
                                     <span className="inline-flex items-center gap-2 font-medium text-blue-700 dark:text-blue-300">
                                       <span className="inline-block w-3 h-3 bg-blue-500 rounded-full"></span>
                                       AI Condition
                                     </span>
                                     <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">"{condition.value}"</p>
                                   </div>
                                 ) : (
                                   <div className="p-2 rounded bg-gray-50 dark:bg-gray-800">
                                     <span className="text-gray-700 dark:text-gray-300">
                                       {condition.field} {condition.operator} "{condition.value}"
                                     </span>
                                   </div>
                                 )}
                               </div>
                             );
                           })}
                          {rule.conditions.length > 3 && (
                            <div className="text-sm text-muted-foreground">
                              ... and {rule.conditions.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Actions ({rule.actions.length})</Label>
                        <div className="mt-2 space-y-1">
                          {rule.actions.slice(0, 3).map((action, index) => (
                            <div key={index} className="text-sm text-muted-foreground">
                              {action.type.replace('_', ' ')}
                            </div>
                          ))}
                          {rule.actions.length > 3 && (
                            <div className="text-sm text-muted-foreground">
                              ... and {rule.actions.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                   )}
                </CardContent>
            </Card>
          ))}
          
          {rules.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-primary rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Plus className="h-8 w-8 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No workflow rules created</h3>
                <p className="text-muted-foreground mb-6">
                  Create your first workflow rule to automate email processing
                </p>
                <Button onClick={() => setEditingRule('new')} variant="premium" size="lg" className="gap-2">
                  <Plus className="h-5 w-5" />
                  Create Your First Rule
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}