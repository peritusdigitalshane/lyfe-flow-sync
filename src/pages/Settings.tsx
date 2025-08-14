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
import { ArrowLeft, Settings2, Save, Eye, EyeOff } from "lucide-react";

interface MicrosoftOAuthSettings {
  client_id: string;
  client_secret: string;
  tenant_id: string;
}

export default function Settings() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [settings, setSettings] = useState<MicrosoftOAuthSettings>({
    client_id: "",
    client_secret: "",
    tenant_id: "common",
  });

  useEffect(() => {
    if (user) {
      fetchSettings();
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

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({
          key: "microsoft_oauth",
          value: settings as any,
          description: "Microsoft Azure OAuth configuration for mailbox connections",
        }, {
          onConflict: 'key'
        });

      if (error) throw error;

      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
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
      </main>
    </div>
  );
}