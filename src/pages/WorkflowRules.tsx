import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

import { ImprovedNavigation } from "@/components/ImprovedNavigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function WorkflowRules() {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin } = useRoles();
  const { toast } = useToast();
  const [rules, setRules] = useState<WorkflowRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
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
      
      // Load suggested rules after data is loaded
      await loadSuggestedRules();
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

  const loadSuggestedRules = async () => {
    try {
      setLoadingSuggestions(true);
      
      // Get email patterns that could benefit from automation
      const { data: emailStats, error: statsError } = await supabase
        .from('emails')
        .select(`
          microsoft_id,
          sender_email,
          sender_name,
          subject
        `)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      if (statsError) throw statsError;

      // Get classifications for these emails
      const emailIds = emailStats?.map(email => email.microsoft_id) || [];
      const { data: classifications } = await supabase
        .from('email_classifications')
        .select(`
          email_id,
          category_id,
          email_categories (
            id,
            name,
            color
          )
        `)
        .in('email_id', emailIds);

      // Create a map of email_id to classification
      const classificationMap = new Map();
      classifications?.forEach(classification => {
        classificationMap.set(classification.email_id, classification);
      });

      // Analyze patterns for suggestions
      const suggestions = [];
      
      // Group emails by sender
      const senderStats = new Map();
      emailStats?.forEach(email => {
        const key = email.sender_email;
        const classification = classificationMap.get(email.microsoft_id);
        const category = classification?.email_categories;
        
        if (!senderStats.has(key)) {
          senderStats.set(key, {
            sender_email: email.sender_email,
            sender_name: email.sender_name,
            count: 0,
            categories: new Set(),
            category_name: category?.name,
            category_color: category?.color
          });
        }
        const stats = senderStats.get(key);
        stats.count++;
        if (classification?.category_id) {
          stats.categories.add(classification.category_id);
        }
      });

      // Find senders with high volume (5+ emails) that don't have rules
      for (const [sender, stats] of senderStats) {
        if (stats.count >= 5) {
          // Check if there's already a rule for this sender
          const hasRule = rules.some(rule => 
            rule.conditions?.some(condition => 
              condition.field === 'sender_email' && 
              (condition.value === sender || sender.includes(condition.value as string))
            )
          );

          if (!hasRule) {
            suggestions.push({
              type: 'sender_automation',
              title: `Automate emails from ${stats.sender_name || sender}`,
              description: `${stats.count} emails in the last 30 days`,
              impact: `Save time by automatically categorizing emails from this sender`,
              suggestion_data: {
                sender_email: sender,
                sender_name: stats.sender_name,
                category_name: stats.category_name,
                category_color: stats.category_color,
                email_count: stats.count
              }
            });
          }
        }
      }

      // Group by subject patterns (e.g., newsletters, notifications)
      const subjectPatterns = new Map();
      emailStats?.forEach(email => {
        // Extract common patterns from subjects
        const subject = email.subject.toLowerCase();
        let pattern = null;
        
        if (subject.includes('newsletter') || subject.includes('update') || subject.includes('digest')) {
          pattern = 'newsletter';
        } else if (subject.includes('notification') || subject.includes('alert')) {
          pattern = 'notification';
        } else if (subject.includes('invoice') || subject.includes('receipt') || subject.includes('payment')) {
          pattern = 'billing';
        }

        if (pattern) {
          const classification = classificationMap.get(email.microsoft_id);
          const category = classification?.email_categories;
          
          if (!subjectPatterns.has(pattern)) {
            subjectPatterns.set(pattern, {
              pattern,
              count: 0,
              examples: [],
              category_name: category?.name,
              category_color: category?.color
            });
          }
          const stats = subjectPatterns.get(pattern);
          stats.count++;
          if (stats.examples.length < 3) {
            stats.examples.push(email.subject);
          }
        }
      });

      // Add subject pattern suggestions
      for (const [pattern, stats] of subjectPatterns) {
        if (stats.count >= 3) {
          const hasRule = rules.some(rule => 
            rule.conditions?.some(condition => 
              condition.field === 'subject' && 
              (condition.value as string).toLowerCase().includes(pattern)
            )
          );

          if (!hasRule) {
            suggestions.push({
              type: 'subject_pattern',
              title: `Automate ${pattern} emails`,
              description: `${stats.count} emails matching this pattern in the last 30 days`,
              impact: `Automatically categorize ${pattern} emails`,
              suggestion_data: {
                pattern,
                examples: stats.examples,
                category_name: stats.category_name,
                category_color: stats.category_color,
                email_count: stats.count
              }
            });
          }
        }
      }

      setSuggestedRules(suggestions.slice(0, 5)); // Limit to top 5 suggestions
    } catch (error) {
      console.error('Error loading suggested rules:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const createRuleFromSuggestion = (suggestion: any) => {
    let newRuleFromSuggestion: Partial<WorkflowRule> = {
      name: suggestion.title,
      conditions: [],
      actions: [],
      is_active: true,
      priority: 1
    };

    // Create conditions based on suggestion type
    if (suggestion.type === 'sender_automation') {
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

    // Set up categorization action if category info is available
    if (suggestion.suggestion_data.category_name) {
      const category = categories.find(c => c.name === suggestion.suggestion_data.category_name);
      if (category) {
        newRuleFromSuggestion.actions = [{
          type: 'categorise',
          parameters: { category_id: category.id }
        }];
      }
    }

    setNewRule(newRuleFromSuggestion);
    setEditingRule('new');

    // Remove the suggestion from the list
    setSuggestedRules(prev => prev.filter(s => s !== suggestion));

    toast({
      title: "Rule Template Created",
      description: "Review and customize the rule before saving",
    });
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
                  <div key={index} className="border rounded-lg p-4 bg-muted/30">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{suggestion.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
                        <p className="text-xs text-primary mt-2">{suggestion.impact}</p>
                        
                        {suggestion.suggestion_data.examples && (
                          <div className="mt-3">
                            <p className="text-xs text-muted-foreground mb-1">Example subjects:</p>
                            <div className="text-xs space-y-1">
                              {suggestion.suggestion_data.examples.slice(0, 2).map((example: string, i: number) => (
                                <div key={i} className="bg-background/50 px-2 py-1 rounded text-muted-foreground">
                                  "{example}"
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
                              Most emails go to: {suggestion.suggestion_data.category_name}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <Button
                        variant="outline"
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
                      onClick={() => addCondition(newRule)}
                      className="gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add Standard Condition
                    </Button>
                    <Button
                      type="button"
                      variant="premium"
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
                              onClick={() => addCondition(editingRuleData)}
                              className="gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              Add Standard Condition
                            </Button>
                            <Button
                              type="button"
                              variant="premium"
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
                       {rule.conditions.slice(0, 3).map((condition, index) => (
                         <div key={index} className="text-sm text-muted-foreground">
                           {condition.field === 'ai_analysis' ? (
                             <span className="inline-flex items-center gap-1">
                               <span className="inline-block w-2 h-2 bg-primary rounded-full"></span>
                               AI: "{condition.value}"
                             </span>
                           ) : (
                             `${condition.field} ${condition.operator} "${condition.value}"`
                           )}
                         </div>
                       ))}
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