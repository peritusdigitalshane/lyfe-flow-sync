import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ImprovedNavigation } from "@/components/ImprovedNavigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, EyeOff, Save, TestTube, Loader2, BookOpen, Settings, AlertTriangle, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Textarea } from "@/components/ui/textarea";

interface MicrosoftOAuthSettings {
  client_id: string;
  client_secret: string;
  tenant_id: string;
}

interface OpenAISettings {
  api_key: string;
  model: string;
  max_tokens: number;
  temperature: number;
}

interface QuarantineSettings {
  enabled: boolean;
  ai_enabled: boolean;
  risk_threshold: number;
  suspicious_patterns: string[];
  auto_quarantine_keywords: string[];
  whitelist_domains: string[];
  check_attachments: boolean;
  check_links: boolean;
}

interface StripeSettings {
  enabled: boolean;
  subscription_price: number;
  subscription_name: string;
  currency: string;
  secret_key: string;
}

interface AIPromptSettings {
  condition_evaluator_prompt: string;
  threat_analysis_prompt: string;
  classification_prompt: string;
}

interface ThreatFeedScheduleSettings {
  enabled: boolean;
  schedule: string;
  custom_schedule: string;
}

export default function SuperAdminSettings() {
  const { user } = useAuth();
  const { isSuperAdmin, loading: rolesLoading } = useRoles();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearingQueue, setClearingQueue] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showStripeKey, setShowStripeKey] = useState(false);

  const [oauthSettings, setOauthSettings] = useState<MicrosoftOAuthSettings>({
    client_id: "",
    client_secret: "",
    tenant_id: "common"
  });

  const [openaiSettings, setOpenaiSettings] = useState<OpenAISettings>({
    api_key: "",
    model: "gpt-5-mini-2025-08-07",
    max_tokens: 1000,
    temperature: 0.2
  });

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [testingConnection, setTestingConnection] = useState(false);

  const [quarantineSettings, setQuarantineSettings] = useState<QuarantineSettings>({
    enabled: false,
    ai_enabled: false,
    risk_threshold: 70,
    suspicious_patterns: [
      "urgent action required",
      "verify your account",
      "click here immediately",
      "suspended account",
      "confirm your identity",
      "tax refund",
      "congratulations you've won"
    ],
    auto_quarantine_keywords: [
      "phishing",
      "malware",
      "bitcoin",
      "crypto scam",
      "Nigerian prince"
    ],
    whitelist_domains: [],
    check_attachments: true,
    check_links: true
  });

  const [stripeSettings, setStripeSettings] = useState<StripeSettings>({
    enabled: false,
    subscription_price: 10,
    subscription_name: "Premium Plan",
    currency: "usd",
    secret_key: ""
  });

  const [aiPromptSettings, setAiPromptSettings] = useState<AIPromptSettings>({
    condition_evaluator_prompt: `You are an email classification system. Your task is to evaluate whether an email meets a specific condition.

CONDITION TO EVALUATE: "{condition}"

EMAIL TO ANALYZE:
{email_content}

Based on the email content above, does this email meet the specified condition?

Respond with ONLY a JSON object in this exact format:
{
  "meets_condition": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why the condition is met or not met"
}

Be precise and logical in your evaluation. Consider the semantic meaning of the condition, not just literal keyword matches.`,
    threat_analysis_prompt: `You are a cybersecurity expert analyzing emails for threats. Analyze this email and provide a detailed threat assessment.

Email Details:
Subject: {subject}
Sender: {sender_email}
Content: {content}
Has Attachments: {has_attachments}

Analyze for:
1. Phishing attempts
2. Social engineering tactics
3. Malware indicators
4. Suspicious URLs or attachments
5. Business email compromise (BEC)
6. Urgency tactics and pressure techniques
7. Impersonation attempts

Provide your response as JSON with:
{
  "risk_score": number (0-100),
  "threat_level": "low" | "medium" | "high" | "critical",
  "threat_types": ["phishing", "malware", "bec", "social_engineering"],
  "confidence": number (0-1),
  "reasoning": "detailed explanation",
  "suspicious_indicators": ["list of specific indicators found"],
  "recommended_action": "allow" | "flag" | "quarantine"
}`,
    classification_prompt: `You are an AI email classifier. Analyze the following email and categorize it based on the provided categories.

Email Content:
Subject: {subject}
Sender: {sender}
Body: {content}

Available Categories:
{categories}

Please classify this email into the most appropriate category. Consider:
- Content relevance
- Sender information
- Subject line
- Overall context

Respond with JSON format:
{
  "category": "category_name",
  "confidence": 0.0-1.0,
  "reasoning": "explanation for the classification"
}`
  });

  const [threatFeedSettings, setThreatFeedSettings] = useState<ThreatFeedScheduleSettings>({
    enabled: true,
    schedule: "0 * * * *", // Every hour by default
    custom_schedule: ""
  });

  useEffect(() => {
    // Wait for roles to load before checking permissions
    if (rolesLoading) return;
    
    if (!user || !isSuperAdmin) {
      console.log("Redirecting to dashboard - user:", !!user, "isSuperAdmin:", isSuperAdmin);
      navigate("/dashboard", { replace: true });
      return;
    }
    
    console.log("User is super admin, fetching settings");
    fetchSettings();
  }, [user, isSuperAdmin, rolesLoading, navigate]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      // Load Microsoft OAuth settings
      const { data: oauthData, error: oauthError } = await supabase
        .from("app_settings")
        .select("*")
        .eq("key", "microsoft_oauth")
        .maybeSingle();

      if (oauthError && oauthError.code !== 'PGRST116') {
        throw oauthError;
      }

      if (oauthData?.value) {
        const oauthConfig = oauthData.value as any;
        setOauthSettings({
          client_id: oauthConfig.client_id || "",
          client_secret: oauthConfig.client_secret || "",
          tenant_id: oauthConfig.tenant_id || "common"
        });
      }

      // Load OpenAI settings
      const { data: openaiData, error: openaiError } = await supabase
        .from("app_settings")
        .select("*")
        .eq("key", "openai_config")
        .maybeSingle();

      if (openaiError && openaiError.code !== 'PGRST116') {
        throw openaiError;
      }

      if (openaiData?.value) {
        const openaiConfig = openaiData.value as any;
        setOpenaiSettings({
          api_key: openaiConfig.api_key || "",
          model: openaiConfig.model || "gpt-5-mini-2025-08-07",
          max_tokens: openaiConfig.max_tokens || 1000,
          temperature: openaiConfig.temperature || 0.2
        });
      }

      // Load quarantine settings
      const { data: quarantineData, error: quarantineError } = await supabase
        .from("app_settings")
        .select("*")
        .eq("key", "quarantine_config")
        .maybeSingle();

      if (quarantineError && quarantineError.code !== 'PGRST116') {
        throw quarantineError;
      }

      if (quarantineData?.value) {
        const quarantineConfig = quarantineData.value as any;
        setQuarantineSettings({
          enabled: quarantineConfig.enabled || false,
          ai_enabled: quarantineConfig.ai_enabled || false,
          risk_threshold: quarantineConfig.risk_threshold || 70,
          suspicious_patterns: quarantineConfig.suspicious_patterns || quarantineSettings.suspicious_patterns,
          auto_quarantine_keywords: quarantineConfig.auto_quarantine_keywords || quarantineSettings.auto_quarantine_keywords,
          whitelist_domains: quarantineConfig.whitelist_domains || [],
          check_attachments: quarantineConfig.check_attachments !== false,
          check_links: quarantineConfig.check_links !== false
        });
      }

      // Load Stripe settings
      const { data: stripeData, error: stripeError } = await supabase
        .from("app_settings")
        .select("*")
        .eq("key", "stripe_config")
        .maybeSingle();

      if (stripeError && stripeError.code !== 'PGRST116') {
        throw stripeError;
      }

      if (stripeData?.value) {
        const stripeConfig = stripeData.value as any;
        setStripeSettings({
          enabled: stripeConfig.enabled || false,
          subscription_price: stripeConfig.subscription_price || 10,
          subscription_name: stripeConfig.subscription_name || "Premium Plan",
          currency: stripeConfig.currency || "usd",
          secret_key: stripeConfig.secret_key || ""
        });
      }

      // Load AI prompt settings
      const { data: aiPromptData, error: aiPromptError } = await supabase
        .from("app_settings")
        .select("*")
        .eq("key", "ai_prompts")
        .maybeSingle();

      if (aiPromptError && aiPromptError.code !== 'PGRST116') {
        throw aiPromptError;
      }

      if (aiPromptData?.value) {
        const aiPromptConfig = aiPromptData.value as any;
        setAiPromptSettings({
          condition_evaluator_prompt: aiPromptConfig.condition_evaluator_prompt || aiPromptSettings.condition_evaluator_prompt,
          threat_analysis_prompt: aiPromptConfig.threat_analysis_prompt || aiPromptSettings.threat_analysis_prompt,
          classification_prompt: aiPromptConfig.classification_prompt || aiPromptSettings.classification_prompt
        });
      }

      // Load threat feed schedule settings
      const { data: threatFeedData, error: threatFeedError } = await supabase
        .from("app_settings")
        .select("*")
        .eq("key", "threat_feed_update_schedule")
        .maybeSingle();

      if (threatFeedError && threatFeedError.code !== 'PGRST116') {
        throw threatFeedError;
      }

      if (threatFeedData?.value) {
        let scheduleValue = "0 * * * *"; // default hourly
        
        if (typeof threatFeedData.value === 'string') {
          scheduleValue = threatFeedData.value;
        } else if (typeof threatFeedData.value === 'object' && threatFeedData.value !== null) {
          const config = threatFeedData.value as any;
          scheduleValue = config.schedule || config.custom_schedule || "0 * * * *";
        }
        
        setThreatFeedSettings({
          enabled: true,
          schedule: scheduleValue,
          custom_schedule: ""
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOAuth = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "microsoft_oauth",
          value: oauthSettings as any,
          description: "Microsoft Azure OAuth configuration for mailbox connections"
        }, {
          onConflict: 'key'
        });

      if (error) throw error;
      toast.success("Microsoft OAuth settings saved successfully");
    } catch (error) {
      console.error("Error saving OAuth settings:", error);
      toast.error("Failed to save OAuth settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOpenAI = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "openai_config",
          value: openaiSettings as any,
          description: "OpenAI configuration for AI-powered email analysis"
        }, {
          onConflict: 'key'
        });

      if (error) throw error;
      toast.success("OpenAI settings saved successfully");
    } catch (error) {
      console.error("Error saving OpenAI settings:", error);
      toast.error("Failed to save OpenAI settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuarantine = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "quarantine_config",
          value: quarantineSettings as any,
          description: "AI-powered quarantine configuration for automatic threat detection"
        }, {
          onConflict: 'key'
        });

      if (error) throw error;
      toast.success("Quarantine settings saved successfully");
    } catch (error) {
      console.error("Error saving quarantine settings:", error);
      toast.error("Failed to save quarantine settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStripe = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "stripe_config",
          value: stripeSettings as any,
          description: "Stripe subscription configuration"
        }, {
          onConflict: 'key'
        });

      if (error) throw error;
      toast.success("Stripe settings saved successfully");
    } catch (error) {
      console.error("Error saving Stripe settings:", error);
      toast.error("Failed to save Stripe settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAIPrompts = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "ai_prompts",
          value: aiPromptSettings as any,
          description: "AI prompt templates for email analysis and classification"
        }, {
          onConflict: 'key'
        });

      if (error) throw error;
      toast.success("AI prompt settings saved successfully");
    } catch (error) {
      console.error("Error saving AI prompt settings:", error);
      toast.error("Failed to save AI prompt settings");
    } finally {
      setSaving(false);
    }
  };

  const handleClearEmailQueue = async () => {
    if (!confirm('Are you sure you want to clear the GLOBAL email processing queue across ALL users and mailboxes? This action cannot be undone.')) {
      return;
    }

    setClearingQueue(true);
    try {
      console.log('Attempting to invoke clear-email-queue function...');
      
      // Add a timeout to the function call
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Function call timed out after 30 seconds')), 30000)
      );
      
      const functionPromise = supabase.functions.invoke('clear-email-queue', {
        body: { 
          timestamp: new Date().toISOString(),
          source: 'super_admin_ui' 
        }
      });
      
      const { data, error } = await Promise.race([functionPromise, timeoutPromise]) as any;
      
      if (error) {
        console.error('Function invoke error:', error);
        
        // More specific error handling
        if (error.message?.includes('Failed to fetch') || error.message?.includes('Failed to send a request')) {
          throw new Error('Edge function is not available. The function may need to be deployed or there may be a network issue.');
        }
        
        throw new Error(`Function error: ${error.message}`);
      }

      console.log('Queue clearance response:', data);
      
      if (data?.success) {
        toast.success(`🚀 Global queue cleared successfully! Processed ${data.processed || 0} emails with ${data.errors || 0} errors.`);
      } else {
        throw new Error(data?.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error clearing global email queue:', error);
      
      let errorMessage = 'Failed to clear email queue';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error(`Failed to clear global email queue: ${errorMessage}`);
    } finally {
      setClearingQueue(false);
    }
  };

  const handleSaveThreatFeedSchedule = async () => {
    setSaving(true);
    try {
      const scheduleValue = threatFeedSettings.schedule === "custom" ? threatFeedSettings.custom_schedule : threatFeedSettings.schedule;
      
      // Update the app_settings
      const { error: settingsError } = await supabase
        .from("app_settings")
        .upsert({
          key: "threat_feed_update_schedule",
          value: scheduleValue,
          description: "Cron schedule for automatic threat feed updates"
        }, {
          onConflict: 'key'
        });

      if (settingsError) throw settingsError;

      // Update the cron job via edge function
      const { error: cronError } = await supabase.functions.invoke('update-cron-schedule', {
        body: {
          schedule: scheduleValue,
          enabled: threatFeedSettings.enabled
        }
      });

      if (cronError) throw cronError;
      
      toast.success("Threat feed schedule updated successfully");
    } catch (error) {
      console.error("Error saving threat feed schedule:", error);
      toast.error("Failed to save threat feed schedule");
    } finally {
      setSaving(false);
    }
  };

  const testOpenAIConnection = async () => {
    if (!openaiSettings.api_key) {
      toast.error("Please enter OpenAI API key");
      return;
    }

    setTestingConnection(true);
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${openaiSettings.api_key}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const modelIds = data.data.map((model: any) => model.id).sort();
        setAvailableModels(modelIds);
        toast.success(`✅ Connection successful! Found ${modelIds.length} available models.`);
      } else if (response.status === 401) {
        toast.error("❌ Invalid API key. Please check your OpenAI API key.");
        setAvailableModels([]);
      } else {
        toast.error("❌ Failed to connect to OpenAI. Please try again.");
        setAvailableModels([]);
      }
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      toast.error("❌ Connection failed. Please check your internet connection.");
      setAvailableModels([]);
    } finally {
      setTestingConnection(false);
    }
  };

  if (rolesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <ImprovedNavigation />
        <main className="container mx-auto px-4 py-8">
          <Breadcrumbs />
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="mt-2 text-muted-foreground">Loading permissions...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <ImprovedNavigation />
        <main className="container mx-auto px-4 py-8">
          <Breadcrumbs />
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="mt-2 text-muted-foreground">Loading settings...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ImprovedNavigation />
      <main className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Super Admin Settings</h1>
              <p className="text-muted-foreground mt-2">
                Configure system-wide settings and integrations
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/admin/diagnostics">
                <Button variant="outline" className="gap-2">
                  <TestTube className="h-4 w-4" />
                  System Diagnostics
                </Button>
              </Link>
              <Link to="/settings">
                <Button variant="outline" className="gap-2">
                  <Settings className="h-4 w-4" />
                  User Settings
                </Button>
              </Link>
            </div>
          </div>

          {/* Documentation & Guides */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Super Admin Documentation
              </CardTitle>
              <CardDescription>
                Access super admin guides and system documentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/super-admin-guide">
                <Button variant="outline" className="w-full h-auto p-4 flex flex-col gap-2">
                  <BookOpen className="h-6 w-6 text-red-500" />
                  <span className="font-medium">Super Admin Guide</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Advanced system configuration and management guide
                  </span>
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Microsoft OAuth Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Microsoft OAuth Configuration</CardTitle>
              <CardDescription>
                Configure Microsoft Azure OAuth for mailbox connections
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <Label htmlFor="client-id">Application ID (Client ID)</Label>
                   <Input
                     id="client-id"
                     type="text"
                     value={oauthSettings.client_id}
                     onChange={(e) => setOauthSettings({
                       ...oauthSettings,
                       client_id: e.target.value
                     })}
                     placeholder="Azure App Registration Application ID"
                   />
                   {oauthSettings.client_id && (
                     <p className="text-sm text-muted-foreground">
                       Current: {oauthSettings.client_id.substring(0, 8)}...
                     </p>
                   )}
                 </div>

                <div className="space-y-2">
                  <Label htmlFor="tenant-id">Tenant ID</Label>
                  <Input
                    id="tenant-id"
                    type="text"
                    value={oauthSettings.tenant_id}
                    onChange={(e) => setOauthSettings({
                      ...oauthSettings,
                      tenant_id: e.target.value
                    })}
                    placeholder="Azure Tenant ID (or 'common')"
                  />
                  {oauthSettings.tenant_id && (
                    <p className="text-sm text-muted-foreground">
                      Current: {oauthSettings.tenant_id}
                    </p>
                  )}
                </div>
              </div>

               <div className="space-y-2">
                 <Label htmlFor="client-secret">Application Secret (Client Secret)</Label>
                 <div className="relative">
                   <Input
                     id="client-secret"
                     type={showClientSecret ? "text" : "password"}
                     value={oauthSettings.client_secret}
                     onChange={(e) => setOauthSettings({
                       ...oauthSettings,
                       client_secret: e.target.value
                     })}
                     placeholder="Azure App Registration Application Secret"
                   />
                   <Button
                     type="button"
                     variant="ghost"
                     size="sm"
                     className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                     onClick={() => setShowClientSecret(!showClientSecret)}
                   >
                     {showClientSecret ? (
                       <EyeOff className="h-4 w-4" />
                     ) : (
                       <Eye className="h-4 w-4" />
                     )}
                   </Button>
                 </div>
                 {oauthSettings.client_secret && (
                   <p className="text-sm text-muted-foreground">
                     Current: {oauthSettings.client_secret.substring(0, 8)}...
                   </p>
                 )}
               </div>

              <Button onClick={handleSaveOAuth} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save OAuth Settings
              </Button>
            </CardContent>
          </Card>

          {/* OpenAI Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>OpenAI Configuration</CardTitle>
              <CardDescription>
                Configure OpenAI for AI-powered email analysis and automation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="openai-key">API Key</Label>
                <div className="relative">
                  <Input
                    id="openai-key"
                    type={showOpenAIKey ? "text" : "password"}
                    value={openaiSettings.api_key}
                    onChange={(e) => setOpenaiSettings({
                      ...openaiSettings,
                      api_key: e.target.value
                    })}
                    placeholder="sk-..."
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                  >
                    {showOpenAIKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">OpenAI Platform</a>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="openai-model">Model</Label>
                  <div className="space-y-2">
                    <Select 
                      value={openaiSettings.model} 
                      onValueChange={(value) => setOpenaiSettings({
                        ...openaiSettings,
                        model: value
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select OpenAI model" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border border-border shadow-lg z-50">
                        {availableModels.length > 0 ? (
                          availableModels.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))
                        ) : (
                          // Fallback models if API hasn't been tested yet
                          <>
                            <SelectItem value="gpt-5-2025-08-07">GPT-5 (Flagship - Best Performance)</SelectItem>
                            <SelectItem value="gpt-5-mini-2025-08-07">GPT-5 Mini (Fast & Cost-Efficient)</SelectItem>
                            <SelectItem value="gpt-5-nano-2025-08-07">GPT-5 Nano (Fastest & Cheapest)</SelectItem>
                            <SelectItem value="gpt-4.1-2025-04-14">GPT-4.1 (Reliable)</SelectItem>
                            <SelectItem value="o3-2025-04-16">O3 (Powerful Reasoning)</SelectItem>
                            <SelectItem value="o4-mini-2025-04-16">O4 Mini (Fast Reasoning)</SelectItem>
                            <SelectItem value="gpt-4.1-mini-2025-04-14">GPT-4.1 Mini (With Vision)</SelectItem>
                            <SelectItem value="gpt-4o">GPT-4o (Legacy - With Vision)</SelectItem>
                            <SelectItem value="gpt-4o-mini">GPT-4o Mini (Legacy - Fast & Cheap)</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    {availableModels.length > 0 ? (
                      <p className="text-sm text-muted-foreground text-green-600">
                        ✅ Showing {availableModels.length} models available with your API key
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        💡 Test your API key to see available models
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-tokens">Max Tokens</Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    min="100"
                    max="4000"
                    value={openaiSettings.max_tokens}
                    onChange={(e) => setOpenaiSettings({
                      ...openaiSettings,
                      max_tokens: parseInt(e.target.value) || 1000
                    })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum tokens for AI responses
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="temperature">Temperature: {openaiSettings.temperature}</Label>
                <input
                  id="temperature"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={openaiSettings.temperature}
                  onChange={(e) => setOpenaiSettings({
                    ...openaiSettings,
                    temperature: parseFloat(e.target.value)
                  })}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Focused (0)</span>
                  <span>Balanced (1)</span>
                  <span>Creative (2)</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveOpenAI} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save OpenAI Settings
                </Button>
                <Button onClick={testOpenAIConnection} disabled={testingConnection || saving} variant="outline" className="gap-2">
                  {testingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                  {testingConnection ? "Testing..." : "Test Connection & Fetch Models"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quarantine Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Quarantine Settings</CardTitle>
              <CardDescription>
                Configure AI-powered quarantine and threat detection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-4">
                <Switch
                  id="quarantine-enabled"
                  checked={quarantineSettings.enabled}
                  onCheckedChange={(checked) => setQuarantineSettings({
                    ...quarantineSettings,
                    enabled: checked as boolean
                  })}
                />
                <Label htmlFor="quarantine-enabled">Enable Quarantine</Label>
              </div>

              <div className="flex items-center space-x-4">
                <Switch
                  id="quarantine-ai-enabled"
                  checked={quarantineSettings.ai_enabled}
                  onCheckedChange={(checked) => setQuarantineSettings({
                    ...quarantineSettings,
                    ai_enabled: checked as boolean
                  })}
                />
                <Label htmlFor="quarantine-ai-enabled">Enable AI Analysis</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="risk-threshold">Risk Threshold: {quarantineSettings.risk_threshold}</Label>
                <input
                  id="risk-threshold"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={quarantineSettings.risk_threshold}
                  onChange={(e) => setQuarantineSettings({
                    ...quarantineSettings,
                    risk_threshold: parseInt(e.target.value)
                  })}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="suspicious-patterns">Suspicious Patterns (one per line)</Label>
                <Textarea
                  id="suspicious-patterns"
                  value={quarantineSettings.suspicious_patterns.join("\n")}
                  onChange={(e) => setQuarantineSettings({
                    ...quarantineSettings,
                    suspicious_patterns: e.target.value.split("\n").map(s => s.trim()).filter(Boolean)
                  })}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="auto-quarantine-keywords">Auto Quarantine Keywords (one per line)</Label>
                <Textarea
                  id="auto-quarantine-keywords"
                  value={quarantineSettings.auto_quarantine_keywords.join("\n")}
                  onChange={(e) => setQuarantineSettings({
                    ...quarantineSettings,
                    auto_quarantine_keywords: e.target.value.split("\n").map(s => s.trim()).filter(Boolean)
                  })}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whitelist-domains">Whitelist Domains (one per line)</Label>
                <Textarea
                  id="whitelist-domains"
                  value={quarantineSettings.whitelist_domains.join("\n")}
                  onChange={(e) => setQuarantineSettings({
                    ...quarantineSettings,
                    whitelist_domains: e.target.value.split("\n").map(s => s.trim()).filter(Boolean)
                  })}
                  rows={4}
                />
              </div>

              <div className="flex items-center space-x-4">
                <Switch
                  id="check-attachments"
                  checked={quarantineSettings.check_attachments}
                  onCheckedChange={(checked) => setQuarantineSettings({
                    ...quarantineSettings,
                    check_attachments: checked as boolean
                  })}
                />
                <Label htmlFor="check-attachments">Check Attachments</Label>
              </div>

              <div className="flex items-center space-x-4">
                <Switch
                  id="check-links"
                  checked={quarantineSettings.check_links}
                  onCheckedChange={(checked) => setQuarantineSettings({
                    ...quarantineSettings,
                    check_links: checked as boolean
                  })}
                />
                <Label htmlFor="check-links">Check Links</Label>
              </div>

              <Button onClick={handleSaveQuarantine} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Quarantine Settings
              </Button>
            </CardContent>
          </Card>

          {/* Stripe Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Stripe Settings</CardTitle>
              <CardDescription>
                Configure Stripe subscription and payment settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-4">
                <Switch
                  id="stripe-enabled"
                  checked={stripeSettings.enabled}
                  onCheckedChange={(checked) => setStripeSettings({
                    ...stripeSettings,
                    enabled: checked as boolean
                  })}
                />
                <Label htmlFor="stripe-enabled">Enable Stripe Subscription</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscription-price">Subscription Price (USD)</Label>
                <Input
                  id="subscription-price"
                  type="number"
                  min="0"
                  value={stripeSettings.subscription_price}
                  onChange={(e) => setStripeSettings({
                    ...stripeSettings,
                    subscription_price: parseFloat(e.target.value) || 0
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscription-name">Subscription Name</Label>
                <Input
                  id="subscription-name"
                  type="text"
                  value={stripeSettings.subscription_name}
                  onChange={(e) => setStripeSettings({
                    ...stripeSettings,
                    subscription_name: e.target.value
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  type="text"
                  value={stripeSettings.currency}
                  onChange={(e) => setStripeSettings({
                    ...stripeSettings,
                    currency: e.target.value
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stripe-secret-key">Stripe Secret Key</Label>
                <div className="relative">
                  <Input
                    id="stripe-secret-key"
                    type={showStripeKey ? "text" : "password"}
                    value={stripeSettings.secret_key}
                    onChange={(e) => setStripeSettings({
                      ...stripeSettings,
                      secret_key: e.target.value
                    })}
                    placeholder="sk_live_..."
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowStripeKey(!showStripeKey)}
                  >
                    {showStripeKey ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button onClick={handleSaveStripe} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Stripe Settings
              </Button>
            </CardContent>
          </Card>

          {/* Threat Feed Schedule Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Threat Feed Auto-Update Schedule</CardTitle>
              <CardDescription>
                Configure automatic updates for threat intelligence feeds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-4">
                <Switch
                  id="threat-feed-enabled"
                  checked={threatFeedSettings.enabled}
                  onCheckedChange={(checked) => setThreatFeedSettings({
                    ...threatFeedSettings,
                    enabled: checked as boolean
                  })}
                />
                <Label htmlFor="threat-feed-enabled">Enable Automatic Updates</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="schedule-preset">Update Schedule</Label>
                <Select 
                  value={threatFeedSettings.schedule} 
                  onValueChange={(value) => setThreatFeedSettings({
                    ...threatFeedSettings,
                    schedule: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select update schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="*/15 * * * *">Every 15 minutes</SelectItem>
                    <SelectItem value="*/30 * * * *">Every 30 minutes</SelectItem>
                    <SelectItem value="0 * * * *">Every hour (recommended)</SelectItem>
                    <SelectItem value="0 */6 * * *">Every 6 hours</SelectItem>
                    <SelectItem value="0 */12 * * *">Every 12 hours</SelectItem>
                    <SelectItem value="0 0 * * *">Daily at midnight</SelectItem>
                    <SelectItem value="custom">Custom cron expression</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {threatFeedSettings.schedule === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="custom-schedule">Custom Cron Expression</Label>
                  <Input
                    id="custom-schedule"
                    type="text"
                    value={threatFeedSettings.custom_schedule}
                    onChange={(e) => setThreatFeedSettings({
                      ...threatFeedSettings,
                      custom_schedule: e.target.value
                    })}
                    placeholder="0 * * * * (hourly)"
                  />
                  <p className="text-sm text-muted-foreground">
                    Use standard cron format: minute hour day month dayofweek
                  </p>
                </div>
              )}

              <Button onClick={handleSaveThreatFeedSchedule} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Schedule Settings
              </Button>
            </CardContent>
          </Card>

          {/* Email Queue Management */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Global Email Queue Management
              </CardTitle>
              <CardDescription>
                Super Admin tools to manage email processing across all users and mailboxes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Trash2 className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-900">Clear Global Processing Queue</h4>
                    <p className="text-sm text-red-700 mt-1">
                      This will force-process ALL stuck emails in the pending queue across ALL users and mailboxes. 
                      Use this to resolve system-wide processing backlogs.
                    </p>
                    <p className="text-xs text-red-600 mt-2 font-medium">
                      ⚠️ This action affects all users in the system
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={handleClearEmailQueue}
                  disabled={clearingQueue || saving}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  size="lg"
                >
                  {clearingQueue ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Clearing Global Queue...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      🚨 Clear Global Email Queue
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AI Prompt Settings */}
          <Card>
            <CardHeader>
              <CardTitle>AI Prompt Settings</CardTitle>
              <CardDescription>
                Customize AI prompt templates for email analysis and classification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="condition-evaluator-prompt">Condition Evaluator Prompt</Label>
                <Textarea
                  id="condition-evaluator-prompt"
                  value={aiPromptSettings.condition_evaluator_prompt}
                  onChange={(e) => setAiPromptSettings({
                    ...aiPromptSettings,
                    condition_evaluator_prompt: e.target.value
                  })}
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="threat-analysis-prompt">Threat Analysis Prompt</Label>
                <Textarea
                  id="threat-analysis-prompt"
                  value={aiPromptSettings.threat_analysis_prompt}
                  onChange={(e) => setAiPromptSettings({
                    ...aiPromptSettings,
                    threat_analysis_prompt: e.target.value
                  })}
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="classification-prompt">Classification Prompt</Label>
                <Textarea
                  id="classification-prompt"
                  value={aiPromptSettings.classification_prompt}
                  onChange={(e) => setAiPromptSettings({
                    ...aiPromptSettings,
                    classification_prompt: e.target.value
                  })}
                  rows={6}
                />
              </div>

              <Button onClick={handleSaveAIPrompts} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save AI Prompt Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
