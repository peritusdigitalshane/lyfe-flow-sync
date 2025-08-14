import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
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

export default function Settings() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
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
      if (isSuperAdmin) {
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
                    <Label htmlFor="client-id">Client ID</Label>
                    <Input
                      id="client-id"
                      type="text"
                      value={oauthSettings.client_id}
                      onChange={(e) => setOauthSettings({
                        ...oauthSettings,
                        client_id: e.target.value
                      })}
                      placeholder="Azure App Registration Client ID"
                    />
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
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-secret">Client Secret</Label>
                  <div className="relative">
                    <Input
                      id="client-secret"
                      type={showClientSecret ? "text" : "password"}
                      value={oauthSettings.client_secret}
                      onChange={(e) => setOauthSettings({
                        ...oauthSettings,
                        client_secret: e.target.value
                      })}
                      placeholder="Azure App Registration Client Secret"
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
                </div>

                <Button onClick={handleSaveOAuth} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save OAuth Settings
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}