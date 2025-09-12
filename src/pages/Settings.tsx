import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { User, LogOut, Save, Loader2, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

interface EmailSettings {
  polling_interval_minutes: number;
  max_emails_per_poll: number;
  auto_categorise: boolean;
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    polling_interval_minutes: 5,
    max_emails_per_poll: 50,
    auto_categorise: true
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
          auto_categorise: emailConfig.auto_categorise !== false
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
              <Link to="/email-categories">
                <Button variant="outline" className="gap-2">
                  <User className="h-4 w-4" />
                  Manage Categories
                </Button>
              </Link>
            </div>
          </div>

          {/* Documentation & Guides */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Documentation & Guides
              </CardTitle>
              <CardDescription>
                Access comprehensive guides and documentation for the platform
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
        </div>
      </main>
    </div>
  );
}