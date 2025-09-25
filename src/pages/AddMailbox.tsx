import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Mail, Zap } from "lucide-react";

const presets = [
  {
    id: "starter",
    name: "Starter",
    description: "Basic email organisation for beginners",
    config: {
      monitorFolders: ["Inbox"],
      useCategories: false,
      rules: [],
      quarantineFirstWeek: true,
    },
  },
  {
    id: "newsletter",
    name: "Newsletter Tidy-up",
    description: "Automatically sort newsletters and promotional emails",
    config: {
      monitorFolders: ["Inbox"],
      useCategories: true,
      rules: [
        {
          name: "Newsletters",
          conditions: ["contains:unsubscribe", "contains:newsletter"],
          actions: ["label:Newsletter", "move:Newsletter"],
        },
      ],
      quarantineFirstWeek: true,
    },
  },
  {
    id: "finance",
    name: "Finance-first",
    description: "Prioritise financial and business communications",
    config: {
      monitorFolders: ["Inbox"],
      useCategories: true,
      rules: [
        {
          name: "Financial",
          conditions: ["contains:invoice", "contains:payment", "contains:bank"],
          actions: ["label:Financial", "flag:true"],
        },
      ],
      quarantineFirstWeek: false,
    },
  },
  {
    id: "labelling",
    name: "Labelling-only",
    description: "Add labels without moving emails",
    config: {
      monitorFolders: ["Inbox"],
      useCategories: true,
      rules: [],
      quarantineFirstWeek: false,
    },
  },
];

export default function AddMailbox() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState("starter");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const emailAddress = formData.get("emailAddress") as string;
    const displayName = formData.get("displayName") as string;

    try {
      console.log('Calling edge function...');
      const { data, error } = await supabase.functions.invoke('mailbox-api', {
        body: {
          emailAddress,
          displayName,
          preset: selectedPreset,
        },
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || "Failed to create mailbox");
      }

      console.log('Function response:', data);
      const { authUrl } = data;
      
      // Redirect to Microsoft OAuth
      window.location.href = authUrl;
    } catch (error) {
      console.error("Error creating mailbox:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create mailbox");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPresetConfig = presets.find(p => p.id === selectedPreset);

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
          <h1 className="text-3xl font-bold mb-2">Add New Mailbox</h1>
          <p className="text-muted-foreground">
            Connect your Microsoft Outlook or Exchange account to start automating your emails
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Mailbox Details
            </CardTitle>
            <CardDescription>
              Enter your email details and choose a preset configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="emailAddress">Email Address</Label>
                <Input
                  id="emailAddress"
                  name="emailAddress"
                  type="email"
                  placeholder="your@company.com"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This should be your Microsoft Outlook or Exchange email address
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  name="displayName"
                  type="text"
                  placeholder="Work Email"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  A friendly name to identify this mailbox
                </p>
              </div>

              <div className="space-y-4">
                <Label>Configuration Preset</Label>
                <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        <div>
                          <div className="font-medium">{preset.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {preset.description}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedPresetConfig && (
                  <Card className="border-muted">
                    <CardContent className="pt-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        {selectedPresetConfig.name} Configuration
                      </h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>• Monitor folders: {selectedPresetConfig.config.monitorFolders.join(", ")}</p>
                        <p>• Categories: {selectedPresetConfig.config.useCategories ? "Enabled" : "Disabled"}</p>
                        <p>• Rules: {selectedPresetConfig.config.rules.length} configured</p>
                        <p>• Quarantine first week: {selectedPresetConfig.config.quarantineFirstWeek ? "Yes" : "No"}</p>
                      </div>
                      <div className="mt-2 text-xs text-blue-600">
                        💡 Tip: {selectedPreset === "starter" && "Inbox only is simplest to start with"}
                         {selectedPreset === "newsletter" && "Use 4–7 categories for best organisation"}
                        {selectedPreset === "finance" && "Financial emails will be flagged for priority"}
                        {selectedPreset === "labelling" && "Start with Quarantine for week 1 to test rules safely"}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating mailbox..." : "Connect to Microsoft"}
              </Button>

              <div className="text-xs text-muted-foreground text-center space-y-2">
                <p>
                  By clicking "Connect to Microsoft", you'll be redirected to Microsoft to grant 
                  permission for LyfeFlow to access your mailbox.
                </p>
                <p>
                  Required permissions: Read and write access to your mail and shared mailboxes.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
