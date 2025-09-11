import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, EyeOff, User, LogOut, Save, TestTube, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

interface EmailSettings {
  polling_interval_minutes: number;
  max_emails_per_poll: number;
  auto_categorise: boolean;
}

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

export default function Settings() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showStripeKey, setShowStripeKey] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    polling_interval_minutes: 5,
    max_emails_per_poll: 50,
    auto_categorise: true
  });

  const [oauthSettings, setOauthSettings] = useState<MicrosoftOAuthSettings>({
    client_id: "",
    client_secret: "",
    tenant_id: "common"
  });

  const [openaiSettings, setOpenaiSettings] = useState<OpenAISettings>({
    api_key: "",
    model: "gpt-4.1-2025-04-14",
    max_tokens: 1000,
    temperature: 0.2
  });

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

  useEffect(() => {
    if (!user) return;
    checkSuperAdminStatus();
    fetchSettings();
  }, [user]);

  const checkSuperAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .eq("role", "super_admin")
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setIsSuperAdmin(!!data);
    } catch (error) {
      console.error("Error checking super admin status:", error);
      setIsSuperAdmin(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      // Check super admin status first
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .eq("role", "super_admin")
        .single();

      const isAdmin = !roleError && !!roleData;
      setIsSuperAdmin(isAdmin);
      
      // Load email settings
      const { data: emailData, error: emailError } = await supabase
        .from("app_settings")
        .select("*")
        .eq("key", "email_config")
        .maybeSingle();

      if (emailError && emailError.code !== 'PGRST116') {
        throw emailError;
      }

      if (emailData?.value) {
        const emailConfig = emailData.value as any;
        setEmailSettings({
          polling_interval_minutes: emailConfig.polling_interval_minutes || 5,
          max_emails_per_poll: emailConfig.max_emails_per_poll || 50,
          auto_categorise: emailConfig.auto_categorise !== false
        });
      }

      // Load Microsoft OAuth settings (super admin only)
      if (isAdmin) {
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
          console.log('Loading OAuth config:', oauthConfig);
          setOauthSettings({
            client_id: oauthConfig.client_id || "",
            client_secret: oauthConfig.client_secret || "",
            tenant_id: oauthConfig.tenant_id || "common"
          });
        }

        // Load quarantine settings (super admin only)
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
            suspicious_patterns: quarantineConfig.suspicious_patterns || [
              "urgent action required",
              "verify your account",
              "click here immediately",
              "suspended account",
              "confirm your identity",
              "tax refund",
              "congratulations you've won"
            ],
            auto_quarantine_keywords: quarantineConfig.auto_quarantine_keywords || [
              "phishing",
              "malware", 
              "bitcoin",
              "crypto scam",
              "Nigerian prince"
            ],
            whitelist_domains: quarantineConfig.whitelist_domains || [],
            check_attachments: quarantineConfig.check_attachments !== false,
            check_links: quarantineConfig.check_links !== false
          });
        }

        // Load Stripe settings (super admin only)
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
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmail = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "email_config",
          value: emailSettings as any,
          description: "Email processing configuration"
        }, {
          onConflict: 'key'
        });

      if (error) throw error;

      toast.success("Email settings saved successfully");
    } catch (error) {
      console.error("Error saving email settings:", error);
      toast.error("Failed to save email settings");
    } finally {
      setSaving(false);
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

  const testOpenAIConnection = async () => {
    if (!openaiSettings.api_key) {
      toast.error("Please enter OpenAI API key");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${openaiSettings.api_key}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success("✅ OpenAI connection successful!");
      } else if (response.status === 401) {
        toast.error("❌ Invalid API key. Please check your OpenAI API key.");
      } else {
        toast.error("❌ Failed to connect to OpenAI. Please try again.");
      }
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      toast.error("❌ Connection failed. Please check your internet connection.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/auth";
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
          <p className="mt-2 text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-primary rounded-lg shadow-glow-primary"></div>
                <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Lyfe Email Management
                </h1>
              </div>
              <nav className="hidden md:flex items-center space-x-6">
                <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
                  Dashboard
                </Link>
                <Link to="/email-categories" className="text-muted-foreground hover:text-foreground">
                  Categories
                </Link>
                <Link to="/workflows" className="text-muted-foreground hover:text-foreground">
                  Workflows
                </Link>
                <Link to="/workflow-rules" className="text-muted-foreground hover:text-foreground">
                  Rules
                </Link>
                <Link to="/settings" className="text-foreground font-medium">
                  Settings
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Welcome, {user.email}</span>
              </div>
              <Button onClick={handleSignOut} variant="ghost" size="sm" className="gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground mt-2">
                Configure your email automation and system preferences
              </p>
            </div>
            <div className="flex gap-3">
              {isSuperAdmin && (
                <Link to="/admin/diagnostics">
                  <Button variant="outline" className="gap-2">
                    <TestTube className="h-4 w-4" />
                    Admin Diagnostics
                  </Button>
                </Link>
              )}
              <Link to="/email-categories">
                <Button variant="outline" className="gap-2">
                  <User className="h-4 w-4" />
                  Manage Categories
                </Button>
              </Link>
            </div>
          </div>

          {/* Email Processing Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Email Processing</CardTitle>
              <CardDescription>
                Configure how emails are processed and analysed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="polling-interval">Polling Interval (minutes)</Label>
                  <Input
                    id="polling-interval"
                    type="number"
                    min="1"
                    max="60"
                    value={emailSettings.polling_interval_minutes}
                    onChange={(e) => setEmailSettings({
                      ...emailSettings,
                      polling_interval_minutes: parseInt(e.target.value) || 5
                    })}
                  />
                  <p className="text-sm text-muted-foreground">
                    How often to check for new emails
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-emails">Max Emails per Poll</Label>
                  <Input
                    id="max-emails"
                    type="number"
                    min="10"
                    max="200"
                    value={emailSettings.max_emails_per_poll}
                    onChange={(e) => setEmailSettings({
                      ...emailSettings,
                      max_emails_per_poll: parseInt(e.target.value) || 50
                    })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Maximum number of emails to process per polling cycle
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-categorise"
                  checked={emailSettings.auto_categorise}
                  onCheckedChange={(checked) => setEmailSettings({
                    ...emailSettings,
                    auto_categorise: checked
                  })}
                />
                <Label htmlFor="auto-categorise">Enable automatic email categorisation</Label>
              </div>

              <Button onClick={handleSaveEmail} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Email Settings
              </Button>
            </CardContent>
          </Card>

          {/* Microsoft OAuth Settings (Super Admin Only) */}
          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Microsoft OAuth Configuration</CardTitle>
                <CardDescription>
                  Configure Microsoft Azure OAuth for mailbox connections (Super Admin Only)
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
                       placeholder={oauthSettings.client_id ? "" : "Azure App Registration Application ID"}
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
                      placeholder={oauthSettings.tenant_id ? "" : "Azure Tenant ID (or 'common')"}
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
                       placeholder={oauthSettings.client_secret ? "" : "Azure App Registration Application Secret"}
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
          )}

          {/* OpenAI Configuration (Super Admin Only) */}
          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>OpenAI Configuration</CardTitle>
                <CardDescription>
                  Configure OpenAI for AI-powered email analysis and automation (Super Admin Only)
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
                      <SelectContent>
                        <SelectItem value="gpt-4.1-2025-04-14">GPT-4.1 (Recommended)</SelectItem>
                        <SelectItem value="o3-2025-04-16">O3 (Reasoning)</SelectItem>
                        <SelectItem value="o4-mini-2025-04-16">O4 Mini (Fast Reasoning)</SelectItem>
                        <SelectItem value="gpt-4.1-mini-2025-04-14">GPT-4.1 Mini</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      GPT-4.1 is recommended for most use cases
                    </p>
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
                    max="1"
                    step="0.1"
                    value={openaiSettings.temperature}
                    onChange={(e) => setOpenaiSettings({
                      ...openaiSettings,
                      temperature: parseFloat(e.target.value)
                    })}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>More Focused (0.0)</span>
                    <span>More Creative (1.0)</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSaveOpenAI} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save OpenAI Settings
                  </Button>
                  
                  <Button 
                    onClick={testOpenAIConnection} 
                    disabled={saving || !openaiSettings.api_key}
                    variant="outline" 
                    className="gap-2"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                    Test Connection
                  </Button>
                  
                  <Link to="/ai-classification">
                    <Button variant="outline" className="gap-2">
                      <TestTube className="h-4 w-4" />
                      Test AI Classification
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI-Powered Quarantine Settings (Super Admin Only) */}
          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>AI-Powered Quarantine System</CardTitle>
                <CardDescription>
                  Configure automatic threat detection and quarantine using AI analysis (Super Admin Only)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Master Enable/Disable */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="quarantine-enabled"
                      checked={quarantineSettings.enabled}
                      onCheckedChange={(checked) => setQuarantineSettings({
                        ...quarantineSettings,
                        enabled: checked
                      })}
                    />
                    <Label htmlFor="quarantine-enabled" className="text-base font-medium">
                      Enable Global Quarantine System
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-6">
                    When enabled, this system will automatically quarantine suspicious emails across all mailboxes
                  </p>
                </div>

                <Separator />

                {/* AI-Powered Detection */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="ai-quarantine-enabled"
                      checked={quarantineSettings.ai_enabled}
                      onCheckedChange={(checked) => setQuarantineSettings({
                        ...quarantineSettings,
                        ai_enabled: checked
                      })}
                      disabled={!quarantineSettings.enabled}
                    />
                    <Label htmlFor="ai-quarantine-enabled" className="text-base font-medium">
                      Enable AI Threat Detection
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-6">
                    Uses OpenAI to analyse email content for sophisticated threats and phishing attempts
                  </p>
                </div>

                {/* Risk Threshold */}
                <div className="space-y-2">
                  <Label htmlFor="risk-threshold">
                    AI Risk Threshold: {quarantineSettings.risk_threshold}%
                  </Label>
                  <input
                    id="risk-threshold"
                    type="range"
                    min="30"
                    max="95"
                    step="5"
                    value={quarantineSettings.risk_threshold}
                    onChange={(e) => setQuarantineSettings({
                      ...quarantineSettings,
                      risk_threshold: parseInt(e.target.value)
                    })}
                    disabled={!quarantineSettings.enabled || !quarantineSettings.ai_enabled}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Low Sensitivity (30%)</span>
                    <span>High Sensitivity (95%)</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Emails with AI risk scores above this threshold will be automatically quarantined
                  </p>
                </div>

                <Separator />

                {/* Pattern-Based Detection */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="suspicious-patterns">Suspicious Patterns</Label>
                    <textarea
                      id="suspicious-patterns"
                      className="w-full min-h-[100px] px-3 py-2 border border-input rounded-md bg-background text-sm"
                      value={quarantineSettings.suspicious_patterns.join('\n')}
                      onChange={(e) => setQuarantineSettings({
                        ...quarantineSettings,
                        suspicious_patterns: e.target.value.split('\n').filter(p => p.trim())
                      })}
                      disabled={!quarantineSettings.enabled}
                      placeholder="Enter suspicious patterns, one per line..."
                    />
                    <p className="text-sm text-muted-foreground">
                      Emails containing these phrases will be flagged as suspicious
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="auto-quarantine-keywords">Auto-Quarantine Keywords</Label>
                    <textarea
                      id="auto-quarantine-keywords"
                      className="w-full min-h-[80px] px-3 py-2 border border-input rounded-md bg-background text-sm"
                      value={quarantineSettings.auto_quarantine_keywords.join('\n')}
                      onChange={(e) => setQuarantineSettings({
                        ...quarantineSettings,
                        auto_quarantine_keywords: e.target.value.split('\n').filter(k => k.trim())
                      })}
                      disabled={!quarantineSettings.enabled}
                      placeholder="Enter keywords that trigger immediate quarantine..."
                    />
                    <p className="text-sm text-muted-foreground">
                      Emails containing these keywords will be immediately quarantined
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whitelist-domains">Trusted Domains (Whitelist)</Label>
                    <textarea
                      id="whitelist-domains"
                      className="w-full min-h-[60px] px-3 py-2 border border-input rounded-md bg-background text-sm"
                      value={quarantineSettings.whitelist_domains.join('\n')}
                      onChange={(e) => setQuarantineSettings({
                        ...quarantineSettings,
                        whitelist_domains: e.target.value.split('\n').filter(d => d.trim())
                      })}
                      disabled={!quarantineSettings.enabled}
                      placeholder="example.com&#10;trusted-company.org"
                    />
                    <p className="text-sm text-muted-foreground">
                      Emails from these domains will never be quarantined
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Content Analysis Options */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Content Analysis</h4>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="check-attachments"
                      checked={quarantineSettings.check_attachments}
                      onCheckedChange={(checked) => setQuarantineSettings({
                        ...quarantineSettings,
                        check_attachments: checked
                      })}
                      disabled={!quarantineSettings.enabled}
                    />
                    <Label htmlFor="check-attachments">
                      Flag emails with suspicious attachments
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="check-links"
                      checked={quarantineSettings.check_links}
                      onCheckedChange={(checked) => setQuarantineSettings({
                        ...quarantineSettings,
                        check_links: checked
                      })}
                      disabled={!quarantineSettings.enabled}
                    />
                    <Label htmlFor="check-links">
                      Analyse suspicious links and URLs
                    </Label>
                  </div>
                </div>

                <Button onClick={handleSaveQuarantine} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Quarantine Settings
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Stripe Configuration (Super Admin Only) */}
          {isSuperAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Stripe Configuration</CardTitle>
                <CardDescription>
                  Configure subscription pricing and billing settings (Super Admin Only)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="stripe-enabled"
                    checked={stripeSettings.enabled}
                    onCheckedChange={(checked) => setStripeSettings({
                      ...stripeSettings,
                      enabled: checked
                    })}
                  />
                  <Label htmlFor="stripe-enabled" className="text-base font-medium">
                    Enable Stripe Subscriptions
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground ml-6">
                  When enabled, users will be required to subscribe to access premium features
                </p>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="subscription-name">Subscription Plan Name</Label>
                    <Input
                      id="subscription-name"
                      value={stripeSettings.subscription_name}
                      onChange={(e) => setStripeSettings({
                        ...stripeSettings,
                        subscription_name: e.target.value
                      })}
                      disabled={!stripeSettings.enabled}
                      placeholder="Premium Plan"
                    />
                    <p className="text-sm text-muted-foreground">
                      Display name for the subscription plan
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subscription-price">Monthly Price</Label>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">$</span>
                      <Input
                        id="subscription-price"
                        type="number"
                        min="1"
                        max="999"
                        value={stripeSettings.subscription_price}
                        onChange={(e) => setStripeSettings({
                          ...stripeSettings,
                          subscription_price: parseFloat(e.target.value) || 10
                        })}
                        disabled={!stripeSettings.enabled}
                      />
                      <span className="text-sm text-muted-foreground">/ month</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Monthly subscription price in USD
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={stripeSettings.currency}
                    onValueChange={(value) => setStripeSettings({
                      ...stripeSettings,
                      currency: value
                    })}
                    disabled={!stripeSettings.enabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usd">USD - US Dollar</SelectItem>
                      <SelectItem value="eur">EUR - Euro</SelectItem>
                      <SelectItem value="gbp">GBP - British Pound</SelectItem>
                      <SelectItem value="cad">CAD - Canadian Dollar</SelectItem>
                      <SelectItem value="aud">AUD - Australian Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Currency for subscription billing
                  </p>
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
                      disabled={!stripeSettings.enabled}
                      placeholder="sk_live_... or sk_test_..."
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowStripeKey(!showStripeKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    >
                      {showStripeKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your Stripe secret key for processing payments. Use test keys for development.
                  </p>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Preview</h4>
                  <div className="text-sm text-muted-foreground">
                    <p><strong>Plan:</strong> {stripeSettings.subscription_name}</p>
                    <p><strong>Price:</strong> ${stripeSettings.subscription_price} {stripeSettings.currency.toUpperCase()} / month</p>
                    <p><strong>Status:</strong> {stripeSettings.enabled ? 'Enabled' : 'Disabled'}</p>
                  </div>
                </div>


                <Button onClick={handleSaveStripe} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Stripe Settings
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}