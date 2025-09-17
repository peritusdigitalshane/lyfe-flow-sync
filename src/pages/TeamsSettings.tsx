import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserContext } from "@/hooks/useUserContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Bot, FileText, Settings, Upload, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ModuleGuard } from "@/components/ModuleGuard";
import { ImprovedNavigation } from "@/components/ImprovedNavigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";

interface TeamsSettings {
  id?: string;
  integration_type: 'transcription' | 'bot' | 'both';
  auto_transcription_enabled: boolean;
  meeting_analytics_enabled: boolean;
  action_item_extraction: boolean;
  speaking_time_analysis: boolean;
  bot_enabled: boolean;
  bot_name: string;
  microsoft_app_id?: string;
  microsoft_app_password?: string;
  notification_preferences: {
    email: boolean;
    teams: boolean;
  };
  retention_days: number;
}

export default function TeamsSettings() {
  const { user } = useAuth();
  const { contextUser } = useUserContext();
  const [settings, setSettings] = useState<TeamsSettings>({
    integration_type: 'transcription',
    auto_transcription_enabled: true,
    meeting_analytics_enabled: true,
    action_item_extraction: true,
    speaking_time_analysis: false,
    bot_enabled: false,
    bot_name: 'Meeting Assistant',
    notification_preferences: {
      email: true,
      teams: false
    },
    retention_days: 90
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    if (!contextUser) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("teams_settings")
        .select("*")
        .eq("user_id", contextUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings({
          id: data.id,
          integration_type: data.integration_type as 'transcription' | 'bot' | 'both',
          auto_transcription_enabled: data.auto_transcription_enabled,
          meeting_analytics_enabled: data.meeting_analytics_enabled,
          action_item_extraction: data.action_item_extraction,
          speaking_time_analysis: data.speaking_time_analysis,
          bot_enabled: data.bot_enabled,
          bot_name: data.bot_name,
          microsoft_app_id: data.microsoft_app_id || '',
          microsoft_app_password: data.microsoft_app_password || '',
          notification_preferences: typeof data.notification_preferences === 'object' && 
            data.notification_preferences !== null ? 
            data.notification_preferences as { email: boolean; teams: boolean } : 
            { email: true, teams: false },
          retention_days: data.retention_days
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!contextUser) return;

    try {
      setSaving(true);

      // Get tenant_id from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", contextUser.id)
        .single();

      const settingsData = {
        user_id: contextUser.id,
        tenant_id: profile?.tenant_id,
        integration_type: settings.integration_type,
        auto_transcription_enabled: settings.auto_transcription_enabled,
        meeting_analytics_enabled: settings.meeting_analytics_enabled,
        action_item_extraction: settings.action_item_extraction,
        speaking_time_analysis: settings.speaking_time_analysis,
        bot_enabled: settings.bot_enabled,
        bot_name: settings.bot_name,
        microsoft_app_id: settings.microsoft_app_id,
        microsoft_app_password: settings.microsoft_app_password,
        notification_preferences: settings.notification_preferences,
        retention_days: settings.retention_days
      };

      const { error } = settings.id
        ? await supabase
            .from("teams_settings")
            .update(settingsData)
            .eq("id", settings.id)
        : await supabase
            .from("teams_settings")
            .insert(settingsData)
            .select()
            .single();

      if (error) throw error;

      toast.success("Settings saved successfully");
      fetchSettings(); // Refresh to get the ID if it was a new record
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const createBot = async () => {
    if (!contextUser) return;

    try {
      setSaving(true);

      // Get tenant_id from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", contextUser.id)
        .single();

      const { data, error } = await supabase.functions.invoke('create-teams-bot', {
        body: {
          botName: settings.bot_name,
          tenantId: profile?.tenant_id
        }
      });

      if (error) throw error;

      setSettings(prev => ({ ...prev, bot_enabled: true }));
      toast.success("Meeting bot created successfully! Check the bot configuration tab for next steps.");
      
      console.log('Bot created:', data);
    } catch (error) {
      console.error("Error creating bot:", error);
      toast.error("Failed to create meeting bot");
    } finally {
      setSaving(false);
    }
  };

  const processTranscriptFile = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('process-meeting-transcript', {
        body: formData
      });

      if (error) throw error;

      toast.success("Transcript processed successfully");
    } catch (error) {
      console.error("Error processing transcript:", error);
      toast.error("Failed to process transcript");
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [contextUser]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processTranscriptFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ImprovedNavigation />
      
      <ModuleGuard requiredModule="teams">
        <main className="container mx-auto px-4 py-8">
          <Breadcrumbs />
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Teams Settings</h1>
            <p className="text-muted-foreground">Configure your Microsoft Teams integration</p>
          </div>
          <Button onClick={() => window.location.href = '/teams-overview'} variant="outline">
            Back to Overview
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading settings...</p>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="integration" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="integration">Integration</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="bot">Bot Settings</TabsTrigger>
              <TabsTrigger value="data">Data Management</TabsTrigger>
            </TabsList>

            <TabsContent value="integration" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Integration Type</CardTitle>
                  <CardDescription>
                    Choose how you want to integrate with Microsoft Teams
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="transcription"
                        name="integrationType"
                        checked={settings.integration_type === 'transcription'}
                        onChange={() => setSettings(prev => ({ ...prev, integration_type: 'transcription' }))}
                      />
                      <label htmlFor="transcription" className="flex items-center space-x-3 cursor-pointer">
                        <FileText className="h-5 w-5 text-primary" />
                        <div>
                          <h3 className="font-medium">Transcription Analytics</h3>
                          <p className="text-sm text-muted-foreground">
                            Upload meeting transcripts for AI analysis
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="bot"
                        name="integrationType"
                        checked={settings.integration_type === 'bot'}
                        onChange={() => setSettings(prev => ({ ...prev, integration_type: 'bot' }))}
                      />
                      <label htmlFor="bot" className="flex items-center space-x-3 cursor-pointer">
                        <Bot className="h-5 w-5 text-primary" />
                        <div>
                          <h3 className="font-medium">Bot Integration</h3>
                          <p className="text-sm text-muted-foreground">
                            Deploy bot to automatically join and record meetings
                          </p>
                        </div>
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="both"
                        name="integrationType"
                        checked={settings.integration_type === 'both'}
                        onChange={() => setSettings(prev => ({ ...prev, integration_type: 'both' }))}
                      />
                      <label htmlFor="both" className="flex items-center space-x-3 cursor-pointer">
                        <div className="flex space-x-1">
                          <FileText className="h-5 w-5 text-primary" />
                          <Bot className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium">Both Options</h3>
                          <p className="text-sm text-muted-foreground">
                            Use both transcription analysis and bot integration
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {(settings.integration_type === 'transcription' || settings.integration_type === 'both') && (
                    <Card className="bg-muted/50">
                      <CardContent className="pt-6">
                        <h4 className="font-medium mb-4">Upload Meeting Transcript</h4>
                        <div className="space-y-4">
                          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                            <div className="text-center">
                              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground mb-2">
                                Drag and drop transcript files here, or click to browse
                              </p>
                              <input
                                type="file"
                                accept=".txt,.doc,.docx,.vtt"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="transcript-upload"
                              />
                              <Button 
                                variant="outline" 
                                onClick={() => document.getElementById('transcript-upload')?.click()}
                              >
                                Choose Files
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Supported formats: .txt, .doc, .docx, .vtt (Teams transcript files)
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Analytics Features</CardTitle>
                  <CardDescription>
                    Configure which analytics features to enable for your meetings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Meeting Analytics</Label>
                      <p className="text-sm text-muted-foreground">
                        Generate summaries and insights from meetings
                      </p>
                    </div>
                    <Switch
                      checked={settings.meeting_analytics_enabled}
                      onCheckedChange={(checked) =>
                        setSettings(prev => ({ ...prev, meeting_analytics_enabled: checked }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Action Item Extraction</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically identify and track action items
                      </p>
                    </div>
                    <Switch
                      checked={settings.action_item_extraction}
                      onCheckedChange={(checked) =>
                        setSettings(prev => ({ ...prev, action_item_extraction: checked }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Speaking Time Analysis</Label>
                      <p className="text-sm text-muted-foreground">
                        Track participation and speaking patterns
                      </p>
                    </div>
                    <Switch
                      checked={settings.speaking_time_analysis}
                      onCheckedChange={(checked) =>
                        setSettings(prev => ({ ...prev, speaking_time_analysis: checked }))
                      }
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Auto Transcription</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically enable transcription when possible
                      </p>
                    </div>
                    <Switch
                      checked={settings.auto_transcription_enabled}
                      onCheckedChange={(checked) =>
                        setSettings(prev => ({ ...prev, auto_transcription_enabled: checked }))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="bot" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Meeting Bot Creation</CardTitle>
                  <CardDescription>
                    Create and deploy your Teams meeting bot for all subscribers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <div className="flex items-start space-x-4">
                      <Bot className="h-8 w-8 text-primary mt-1" />
                      <div className="flex-1">
                        <h3 className="font-medium mb-2">Meeting Assistant Bot</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Deploy a bot that automatically joins Teams meetings to record, transcribe, and analyze conversations for all your subscribers.
                        </p>
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="bot-name">Bot Display Name</Label>
                              <Input
                                id="bot-name"
                                value={settings.bot_name}
                                onChange={(e) => setSettings(prev => ({ ...prev, bot_name: e.target.value }))}
                                placeholder="Meeting Assistant"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="bot-description">Bot Description</Label>
                              <Input
                                id="bot-description"
                                placeholder="AI-powered meeting assistant"
                                disabled
                              />
                            </div>
                          </div>
                          
                          {!settings.bot_enabled ? (
                            <Button 
                              onClick={createBot}
                              disabled={saving}
                              className="w-full"
                            >
                              <Bot className="h-4 w-4 mr-2" />
                              {saving ? 'Creating Bot...' : 'Create Meeting Bot'}
                            </Button>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center space-x-2 text-green-600">
                                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-sm font-medium">Bot Active</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <Button variant="outline" size="sm">
                                  <Settings className="h-4 w-4 mr-2" />
                                  Configure
                                </Button>
                                <Button variant="outline" size="sm">
                                  <Download className="h-4 w-4 mr-2" />
                                  Export Manifest
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSettings(prev => ({ ...prev, bot_enabled: false }))}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Bot
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Bot Configuration</CardTitle>
                  <CardDescription>
                    Configure bot behavior and capabilities
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Microsoft Bot Framework Credentials</h4>
                    <p className="text-sm text-muted-foreground">
                      Enter your Azure Bot Service credentials to enable bot authentication
                    </p>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="microsoft-app-id">Microsoft App ID</Label>
                        <Input
                          id="microsoft-app-id"
                          type="text"
                          value={settings.microsoft_app_id || ''}
                          onChange={(e) => setSettings(prev => ({ ...prev, microsoft_app_id: e.target.value }))}
                          placeholder="dc4f4e25-78e1-4006-8201-cffaf7a7d6f3"
                        />
                        <p className="text-xs text-muted-foreground">
                          Found in Azure Portal under your Bot Service application registration
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="microsoft-app-password">Microsoft App Password</Label>
                        <Input
                          id="microsoft-app-password"
                          type="password"
                          value={settings.microsoft_app_password || ''}
                          onChange={(e) => setSettings(prev => ({ ...prev, microsoft_app_password: e.target.value }))}
                          placeholder="Enter your app password/secret"
                        />
                        <p className="text-xs text-muted-foreground">
                          Client secret from Azure Portal - Certificates & secrets section
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Auto-Join Meetings</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically join scheduled meetings when invited
                      </p>
                    </div>
                    <Switch
                      checked={settings.bot_enabled}
                      onCheckedChange={(checked) =>
                        setSettings(prev => ({ ...prev, bot_enabled: checked }))
                      }
                      disabled={!settings.bot_enabled}
                    />
                  </div>

                  {settings.bot_enabled && (
                    <>
                      <Separator />
                      
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Recording Enabled</Label>
                          <p className="text-sm text-muted-foreground">
                            Record meetings for transcription and analysis
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Real-time Transcription</Label>
                          <p className="text-sm text-muted-foreground">
                            Provide live transcription during meetings
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Meeting Insights</Label>
                          <p className="text-sm text-muted-foreground">
                            Generate action items and meeting summaries
                          </p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <Card className="bg-blue-50 dark:bg-blue-950/20">
                        <CardContent className="pt-6">
                          <div className="flex items-start space-x-3">
                            <Bot className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div>
                              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                                Bot Deployment Required
                              </h4>
                              <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                                To use bot integration, you'll need to deploy the bot to Azure. 
                                Contact support for deployment instructions.
                              </p>
                              <Badge variant="outline" className="mt-2">
                                Coming Soon
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="data" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Data Management</CardTitle>
                  <CardDescription>
                    Manage your meeting data and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="retention">Data Retention (Days)</Label>
                    <Select
                      value={settings.retention_days.toString()}
                      onValueChange={(value) => 
                        setSettings(prev => ({ ...prev, retention_days: parseInt(value) }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="60">60 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="180">180 days</SelectItem>
                        <SelectItem value="365">1 year</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Meeting data will be automatically deleted after this period
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-4">Notification Preferences</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Email Notifications</Label>
                          <p className="text-sm text-muted-foreground">
                            Receive email updates about meeting summaries
                          </p>
                        </div>
                        <Switch
                          checked={settings.notification_preferences.email}
                          onCheckedChange={(checked) =>
                            setSettings(prev => ({
                              ...prev,
                              notification_preferences: { ...prev.notification_preferences, email: checked }
                            }))
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-base">Teams Notifications</Label>
                          <p className="text-sm text-muted-foreground">
                            Send notifications through Teams chat
                          </p>
                        </div>
                        <Switch
                          checked={settings.notification_preferences.teams}
                          onCheckedChange={(checked) =>
                            setSettings(prev => ({
                              ...prev,
                              notification_preferences: { ...prev.notification_preferences, teams: checked }
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium">Data Export & Cleanup</h4>
                    <div className="flex space-x-2">
                      <Button variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        Export Data
                      </Button>
                      <Button variant="outline" className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All Data
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={fetchSettings}>
                Reset
              </Button>
              <Button onClick={saveSettings} disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </Tabs>
        )}
        </main>
      </ModuleGuard>
    </div>
  );
}