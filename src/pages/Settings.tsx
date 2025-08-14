import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Settings2, Save, Eye, EyeOff, TestTube } from "lucide-react";

interface MicrosoftOAuthSettings {
  client_id: string;
  client_secret: string;
  tenant_id: string;
}

interface N8NSettings {
  base_url: string;
  api_token: string;
}

export default function Settings() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [showN8NToken, setShowN8NToken] = useState(false);
  const [settings, setSettings] = useState<MicrosoftOAuthSettings>({
    client_id: "",
    client_secret: "",
    tenant_id: "common",
  });
  const [n8nSettings, setN8NSettings] = useState<N8NSettings>({
    base_url: "",
    api_token: "",
  });

  useEffect(() => {
    if (user) {
      fetchSettings();
      fetchN8NSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("key", "microsoft_oauth")
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }

      if (data) {
        const oauthSettings = data.value as any;
        setSettings({
          client_id: oauthSettings.client_id || "",
          client_secret: oauthSettings.client_secret || "",
          tenant_id: oauthSettings.tenant_id || "common",
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchN8NSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("key", "n8n_config")
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }

      if (data) {
        const n8nConfig = data.value as any;
        setN8NSettings({
          base_url: n8nConfig.base_url || "",
          api_token: n8nConfig.api_token || "",
        });
      }
    } catch (error) {
      console.error("Error fetching N8N settings:", error);
    }
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Save Microsoft OAuth settings
      const { error: oauthError } = await supabase
        .from("app_settings")
        .upsert({
          key: "microsoft_oauth",
          value: settings as any,
          description: "Microsoft Azure OAuth configuration for mailbox connections",
        }, {
          onConflict: 'key'
        });

      if (oauthError) throw oauthError;

      toast.success("Microsoft OAuth settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveN8N = async () => {
    setIsSaving(true);

    try {
      // Save N8N settings
      const { error: n8nError } = await supabase
        .from("app_settings")
        .upsert({
          key: "n8n_config",
          value: n8nSettings as any,
          description: "N8N configuration for workflow automation",
        }, {
          onConflict: 'key'
        });

      if (n8nError) throw n8nError;

      toast.success("N8N settings saved successfully");
    } catch (error) {
      console.error("Error saving N8N settings:", error);
      toast.error("Failed to save N8N settings");
    } finally {
      setIsSaving(false);
    }
  };

  const testN8NConnection = async () => {
    if (!n8nSettings.base_url || !n8nSettings.api_token) {
      toast.error("Please enter both N8N Base URL and API Token");
      return;
    }

    setIsTesting(true);
    try {
      // Test the N8N connection by making a simple API call
      const response = await fetch(`${n8nSettings.base_url}/api/v1/workflows`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${n8nSettings.api_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`✅ N8N connection successful! Found ${data.data?.length || 0} workflows.`);
      } else if (response.status === 401) {
        toast.error("❌ Authentication failed. Please check your API token.");
      } else if (response.status === 404) {
        toast.error("❌ N8N API not found. Please check your Base URL.");
      } else {
        const errorText = await response.text();
        toast.error(`❌ Connection failed: ${response.status} ${errorText}`);
      }
    } catch (error: any) {
      if (error.message.includes('fetch')) {
        toast.error("❌ Cannot reach N8N instance. Check the Base URL and ensure N8N is running.");
      } else {
        toast.error(`❌ Connection error: ${error.message}`);
      }
    } finally {
      setIsTesting(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Application Settings</h1>
          <p className="text-muted-foreground">
            Configure global settings for your Lyfe Email Management application
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Microsoft Azure OAuth Configuration
            </CardTitle>
            <CardDescription>
              These credentials will be used for all users connecting their Microsoft mailboxes.
              You can get these from your Azure App Registration.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="client_id">Application (Client) ID</Label>
                <Input
                  id="client_id"
                  type="text"
                  placeholder="12345678-1234-1234-1234-123456789abc"
                  value={settings.client_id}
                  onChange={(e) => setSettings(prev => ({ ...prev, client_id: e.target.value }))}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The Application (client) ID from your Azure App Registration
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client_secret">Client Secret</Label>
                <div className="relative">
                  <Input
                    id="client_secret"
                    type={showClientSecret ? "text" : "password"}
                    placeholder="Enter your client secret"
                    value={settings.client_secret}
                    onChange={(e) => setSettings(prev => ({ ...prev, client_secret: e.target.value }))}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowClientSecret(!showClientSecret)}
                  >
                    {showClientSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The client secret value from your Azure App Registration
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenant_id">Tenant Configuration</Label>
                <Select 
                  value={settings.tenant_id} 
                  onValueChange={(value) => setSettings(prev => ({ ...prev, tenant_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="common">
                      <div>
                        <div className="font-medium">Multi-tenant (Recommended)</div>
                        <div className="text-xs text-muted-foreground">
                          Allow users from any Azure AD tenant
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="consumers">
                      <div>
                        <div className="font-medium">Personal Microsoft Accounts</div>
                        <div className="text-xs text-muted-foreground">
                          Allow personal Microsoft accounts only
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="organizations">
                      <div>
                        <div className="font-medium">Work/School Accounts</div>
                        <div className="text-xs text-muted-foreground">
                          Allow organizational accounts only
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose who can authenticate with your application
                </p>
              </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Azure App Registration Setup</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• Set redirect URI to: <code className="bg-blue-100 px-1 rounded">{window.location.origin}/auth/callback</code></p>
                  <p>• Required permissions: Mail.ReadWrite, openid, profile, email</p>
                  <p>• Enable "Access tokens" and "ID tokens" in Authentication</p>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Saving..." : "Save Settings"}
              </Button>

              <div className="text-xs text-muted-foreground text-center space-y-2">
                <p>
                  These settings are stored securely and will be used for all Microsoft OAuth flows.
                </p>
                <p>
                  Make sure to test the configuration after saving by adding a new mailbox.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              N8N Workflow Configuration
            </CardTitle>
            <CardDescription>
              Configure your N8N instance for automated email workflow management.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="n8n_base_url">N8N Base URL</Label>
                <Input
                  id="n8n_base_url"
                  type="url"
                  placeholder="http://localhost:5678"
                  value={n8nSettings.base_url}
                  onChange={(e) => setN8NSettings(prev => ({ ...prev, base_url: e.target.value }))}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The base URL of your N8N instance (e.g., http://localhost:5678)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="n8n_api_token">N8N API Token</Label>
                <div className="relative">
                  <Input
                    id="n8n_api_token"
                    type={showN8NToken ? "text" : "password"}
                    placeholder="Enter your N8N API token"
                    value={n8nSettings.api_token}
                    onChange={(e) => setN8NSettings(prev => ({ ...prev, api_token: e.target.value }))}
                    required
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowN8NToken(!showN8NToken)}
                  >
                    {showN8NToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The API token from N8N Settings → Personal → API Keys
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">N8N Setup Instructions</h4>
                <div className="text-sm text-green-800 space-y-1">
                  <p>• Go to N8N Settings → Personal → API Keys</p>
                  <p>• Create a new API key with appropriate permissions</p>
                  <p>• Ensure your N8N instance is accessible from this application</p>
                  <p>• Test the connection after entering your settings</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  type="button" 
                  onClick={handleSaveN8N}
                  disabled={isSaving}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Saving..." : "Save N8N Settings"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={testN8NConnection}
                  disabled={isTesting || !n8nSettings.base_url || !n8nSettings.api_token}
                  className="flex-1"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {isTesting ? "Testing..." : "Test Connection"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}