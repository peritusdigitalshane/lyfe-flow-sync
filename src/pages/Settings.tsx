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
  auto_categorize: boolean;
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

export default function Settings() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    polling_interval_minutes: 5,
    max_emails_per_poll: 50,
    auto_categorize: true
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
          auto_categorize: emailConfig.auto_categorize !== false
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
        } else {
          console.log('No OAuth data found in database');
        }

        // Load OpenAI settings (super admin only)
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
            model: openaiConfig.model || "gpt-4.1-2025-04-14",
            max_tokens: openaiConfig.max_tokens || 1000,
            temperature: openaiConfig.temperature || 0.2
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
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Configure your email automation and system preferences
            </p>
          </div>

          {/* Email Processing Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Email Processing</CardTitle>
              <CardDescription>
                Configure how emails are processed and analyzed
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
                  id="auto-categorize"
                  checked={emailSettings.auto_categorize}
                  onCheckedChange={(checked) => setEmailSettings({
                    ...emailSettings,
                    auto_categorize: checked
                  })}
                />
                <Label htmlFor="auto-categorize">Enable automatic email categorization</Label>
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
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}