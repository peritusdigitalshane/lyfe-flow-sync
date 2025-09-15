import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ImprovedNavigation } from "@/components/ImprovedNavigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import ModuleSecurityTest from "@/components/ModuleSecurityTest";
import { toast } from "sonner";
import { User, LogOut, Save, Loader2, BookOpen, Shield, Mail, Settings as SettingsIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface EmailSettings {
  polling_interval_minutes: number;
  max_emails_per_poll: number;
  auto_categorise: boolean;
  threat_quarantine_threshold: number;
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { hasEmailManagement, hasSecurity, modules } = useModules();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    polling_interval_minutes: 5,
    max_emails_per_poll: 50,
    auto_categorise: true,
    threat_quarantine_threshold: 70
  });

  useEffect(() => {
    if (!user) return;
    fetchSettings();
  }, [user]);

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
          auto_categorise: emailConfig.auto_categorise !== false,
          threat_quarantine_threshold: emailConfig.threat_quarantine_threshold || 70
        });
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
      <ImprovedNavigation />
      
      <main className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account settings, modules, and platform configuration
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
            <TabsTrigger value="email-settings">Email Settings</TabsTrigger>
            <TabsTrigger value="security-test">Security Test</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  View and manage your account information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input value={user.email || ''} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>User ID</Label>
                    <Input value={user.id || ''} disabled className="font-mono text-sm" />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button onClick={signOut} variant="destructive" className="gap-2">
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Documentation & Guides */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Documentation & Guides
                </CardTitle>
                <CardDescription>
                  Access comprehensive guides and documentation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <Link to="/user-guide">
                    <Button variant="outline" className="w-full h-auto p-4 flex flex-col gap-2">
                      <BookOpen className="h-6 w-6 text-blue-500" />
                      <span className="font-medium">User Guide</span>
                      <span className="text-xs text-muted-foreground text-center">
                        Complete guide to using email automation features
                      </span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="modules" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  Module Access
                </CardTitle>
                <CardDescription>
                  Your current module assignments and access levels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-medium">Email Management</h3>
                        <p className="text-sm text-muted-foreground">Core email automation and workflow features</p>
                      </div>
                    </div>
                    <Badge variant={hasEmailManagement ? "default" : "secondary"}>
                      {hasEmailManagement ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-destructive" />
                      <div>
                        <h3 className="font-medium">Security Module</h3>
                        <p className="text-sm text-muted-foreground">Advanced security features and threat intelligence</p>
                      </div>
                    </div>
                    <Badge variant={hasSecurity ? "default" : "secondary"}>
                      {hasSecurity ? "Active" : "Not Assigned"}
                    </Badge>
                  </div>
                </div>

                {!hasSecurity && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Request Security Module Access</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      The Security Module includes threat intelligence, advanced monitoring, and compliance features.
                    </p>
                    <Button variant="outline" size="sm">
                      Contact Administrator
                    </Button>
                  </div>
                )}

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Total modules assigned: {modules.length}</p>
                  <p>User ID: {user?.id}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email-settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Email Processing & Security
                </CardTitle>
                <CardDescription>
                  Configure how emails are processed, analysed, and secured
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

                  <div className="space-y-2">
                    <Label htmlFor="threat-threshold">
                      Threat Score Quarantine Threshold
                      {!hasSecurity && (
                        <Badge variant="secondary" className="ml-2 text-xs">Security Module Required</Badge>
                      )}
                    </Label>
                    <Input
                      id="threat-threshold"
                      type="number"
                      min="1"
                      max="100"
                      value={emailSettings.threat_quarantine_threshold}
                      disabled={!hasSecurity}
                      onChange={(e) => setEmailSettings({
                        ...emailSettings,
                        threat_quarantine_threshold: parseInt(e.target.value) || 70
                      })}
                    />
                    <p className="text-sm text-muted-foreground">
                      {hasSecurity 
                        ? "Emails with threat scores above this value will be automatically quarantined (1-100)"
                        : "Security module required for threat intelligence features"
                      }
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
          </TabsContent>

          <TabsContent value="security-test" className="space-y-6">
            <ModuleSecurityTest />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}