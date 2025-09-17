import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy, ExternalLink, Bot, CheckCircle, AlertTriangle, Download, Code } from "lucide-react";
import { ImprovedNavigation } from "@/components/ImprovedNavigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { toast } from "sonner";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function TeamsBotGuide() {
  const [copiedStep, setCopiedStep] = useState<string | null>(null);
  const [botConfig, setBotConfig] = useState<any>(null);

  useEffect(() => {
    fetchBotConfig();
  }, []);

  const fetchBotConfig = async () => {
    try {
      // Fetch the bot configuration from the database
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'teams_bot_3134f649-152a-44a1-897e-f0eb10433384')
        .single();

      if (error) {
        console.error('Error fetching bot config:', error);
        return;
      }

      setBotConfig(data?.value);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const downloadManifest = async () => {
    try {
      let manifest = JSON.parse(manifestExample);
      
      // If we have bot config from database, use it
      if (botConfig?.manifest) {
        manifest = botConfig.manifest;
      }

      const manifestData = JSON.stringify(manifest, null, 2);
      const blob = new Blob([manifestData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manifest.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Manifest downloaded successfully');
    } catch (error) {
      console.error('Error downloading manifest:', error);
      toast.error('Failed to download manifest');
    }
  };

  const downloadIcon = async (type: 'color' | 'outline') => {
    try {
      // Create a simple placeholder icon using canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = type === 'color' ? 192 : 32;
      canvas.width = size;
      canvas.height = size;

      if (type === 'color') {
        // Create a colorful bot icon
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, '#0078D4');
        gradient.addColorStop(1, '#106EBE');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        // Add bot design
        ctx.fillStyle = 'white';
        ctx.font = `${size * 0.6}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🤖', size / 2, size / 2);
      } else {
        // Create outline icon
        ctx.strokeStyle = '#424242';
        ctx.lineWidth = 2;
        ctx.strokeRect(4, 4, size - 8, size - 8);
        
        ctx.fillStyle = '#424242';
        ctx.font = `${size * 0.5}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('AI', size / 2, size / 2);
      }

      canvas.toBlob((blob) => {
        if (!blob) return;
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success(`${type}.png downloaded successfully`);
      }, 'image/png');
    } catch (error) {
      console.error('Error downloading icon:', error);
      toast.error('Failed to download icon');
    }
  };

  const downloadAppPackage = async () => {
    try {
      // Dynamic import for JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Add manifest
      let manifest = JSON.parse(manifestExample);
      if (botConfig?.manifest) {
        manifest = botConfig.manifest;
      }
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));

      // Create and add color icon
      const colorCanvas = document.createElement('canvas');
      const colorCtx = colorCanvas.getContext('2d');
      if (colorCtx) {
        colorCanvas.width = 192;
        colorCanvas.height = 192;
        
        const gradient = colorCtx.createLinearGradient(0, 0, 192, 192);
        gradient.addColorStop(0, '#0078D4');
        gradient.addColorStop(1, '#106EBE');
        
        colorCtx.fillStyle = gradient;
        colorCtx.fillRect(0, 0, 192, 192);
        
        colorCtx.fillStyle = 'white';
        colorCtx.font = '120px Arial';
        colorCtx.textAlign = 'center';
        colorCtx.textBaseline = 'middle';
        colorCtx.fillText('🤖', 96, 96);

        const colorDataUrl = colorCanvas.toDataURL('image/png');
        const colorData = colorDataUrl.split(',')[1];
        zip.file('color.png', colorData, { base64: true });
      }

      // Create and add outline icon
      const outlineCanvas = document.createElement('canvas');
      const outlineCtx = outlineCanvas.getContext('2d');
      if (outlineCtx) {
        outlineCanvas.width = 32;
        outlineCanvas.height = 32;
        
        outlineCtx.strokeStyle = '#424242';
        outlineCtx.lineWidth = 2;
        outlineCtx.strokeRect(2, 2, 28, 28);
        
        outlineCtx.fillStyle = '#424242';
        outlineCtx.font = '16px Arial';
        outlineCtx.textAlign = 'center';
        outlineCtx.textBaseline = 'middle';
        outlineCtx.fillText('AI', 16, 16);

        const outlineDataUrl = outlineCanvas.toDataURL('image/png');
        const outlineData = outlineDataUrl.split(',')[1];
        zip.file('outline.png', outlineData, { base64: true });
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lyfeai-meetings-assistant.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Complete app package downloaded successfully');
    } catch (error) {
      console.error('Error downloading app package:', error);
      toast.error('Failed to download app package');
    }
  };

  const copyToClipboard = async (text: string, stepId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStep(stepId);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedStep(null), 2000);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const webhookUrl = "https://ceasktzguzibehknbgsx.supabase.co/functions/v1/teams-bot-webhook";
  const manifestExample = `{
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.16/MicrosoftTeams.schema.json",
  "manifestVersion": "1.16",
  "version": "1.0.0",
  "id": "YOUR_GENERATED_UUID_HERE",
  "packageName": "com.yourcompany.meetingbot.lyfeai",
  "developer": {
    "name": "Your Company Name",
    "websiteUrl": "https://yourcompany.com",
    "privacyUrl": "https://yourcompany.com/privacy",
    "termsOfUseUrl": "https://yourcompany.com/terms"
  },
  "name": {
    "short": "LyfeAI Meetings Assistant",
    "full": "LyfeAI Meetings Assistant - AI Meeting Bot"
  },
  "description": {
    "short": "AI-powered meeting assistant for recording and analysis",
    "full": "An intelligent meeting bot that joins Teams meetings to provide transcription, recording, and automated insights including action items and summaries."
  },
  "accentColor": "#0078D4",
  "bots": [
    {
      "botId": "YOUR_AZURE_BOT_ID_HERE",
      "scopes": ["team", "personal", "groupchat"],
      "needsChannelSelector": false,
      "isNotificationOnly": false,
      "supportsFiles": false,
      "supportsCalling": true,
      "supportsVideo": true
    }
  ],
  "permissions": ["identity", "messageTeamMembers"],
  "devicePermissions": ["media"],
  "validDomains": ["*.yourcompany.com"]
}`;

  return (
    <div className="min-h-screen bg-background">
      <ImprovedNavigation />
      
      <main className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Teams Meeting Bot Guide</h1>
            <p className="text-xl text-muted-foreground mb-6">
              Complete step-by-step guide to deploy LyfeAI Meetings Assistant
            </p>
            <Alert className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This guide requires Azure Portal access and Teams Admin Center permissions. 
                Estimated completion time: 30-45 minutes.
              </AlertDescription>
            </Alert>
          </div>

          {/* Overview */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                What You'll Build
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Bot Capabilities</h4>
                  <ul className="space-y-1 text-sm">
                    <li>✅ Auto-join Teams meetings</li>
                    <li>✅ Record and transcribe conversations</li>
                    <li>✅ Generate AI-powered summaries</li>
                    <li>✅ Extract action items automatically</li>
                    <li>✅ Respond to voice commands</li>
                    <li>✅ Store data in your database</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Prerequisites</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• Azure subscription with admin access</li>
                    <li>• Microsoft Teams admin privileges</li>
                    <li>• Basic understanding of Azure Portal</li>
                    <li>• 30-45 minutes of time</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 1: Azure Bot Service */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline">Step 1</Badge>
                Create Azure Bot Service
              </CardTitle>
              <CardDescription>
                Register your bot in Microsoft Azure to get authentication credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge className="mt-0.5">1.1</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Navigate to Azure Portal</p>
                    <p className="text-sm text-muted-foreground">
                      Go to <a href="https://portal.azure.com" target="_blank" rel="noopener" className="text-primary underline">portal.azure.com</a> and sign in with your admin account
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Badge className="mt-0.5">1.2</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Create Bot Resource</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Click "Create a resource" → Search for "Azure Bot" → Select "Azure Bot"
                    </p>
                    <div className="bg-muted p-3 rounded-lg text-sm">
                      <p className="font-medium mb-1">Configuration:</p>
                      <p>• <strong>Bot handle:</strong> lyfeai-meetings-assistant</p>
                      <p>• <strong>Subscription:</strong> Your Azure subscription</p>
                      <p>• <strong>Resource group:</strong> Create new or use existing</p>
                      <p>• <strong>Pricing tier:</strong> F0 (Free tier)</p>
                      <p>• <strong>Microsoft App ID:</strong> Create new</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge className="mt-0.5">1.3</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Get Bot Credentials</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      After creation, go to "Configuration" tab and copy:
                    </p>
                    <div className="bg-muted p-3 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <code className="bg-background px-2 py-1 rounded text-xs">Microsoft App ID</code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard("YOUR_MICROSOFT_APP_ID_HERE", "app-id")}
                        >
                          <Copy className="h-3 w-3" />
                          {copiedStep === "app-id" ? "Copied!" : "Copy"}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Save this ID - you'll need it for the manifest
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Configure Webhook */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline">Step 2</Badge>
                Configure Bot Webhook
              </CardTitle>
              <CardDescription>
                Set up the messaging endpoint to connect Azure to your Supabase function
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge className="mt-0.5">2.1</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Set Messaging Endpoint</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      In your Azure Bot's Configuration tab, set the messaging endpoint:
                    </p>
                    <div className="flex items-center gap-2 bg-muted p-3 rounded-lg">
                      <code className="flex-1 text-sm">{webhookUrl}</code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(webhookUrl, "webhook")}
                      >
                        <Copy className="h-3 w-3" />
                        {copiedStep === "webhook" ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge className="mt-0.5">2.2</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Enable Teams Channel</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Go to "Channels" tab → Click "Microsoft Teams" → Configure the following options:
                    </p>
                    <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                      <div>
                        <p className="font-medium mb-1">📝 Messaging Configuration:</p>
                        <p>• Enable <strong>Messaging</strong> (required for text interactions)</p>
                        <p>• Select messaging capabilities as needed</p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">📞 Calling Configuration:</p>
                        <p>• Enable <strong>Calling</strong> (required for meeting bot functionality)</p>
                        <p>• Enable <strong>Media</strong> for audio/video recording</p>
                        <p>• Check "Real-time media" if available</p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">🚀 Publishing:</p>
                        <p>• Select your organization's scope</p>
                        <p>• Enable for production use when ready</p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-2 rounded mt-2">
                        <p className="text-blue-800 dark:text-blue-200 text-xs">
                          ⚠️ <strong>Important:</strong> Calling and Media permissions are essential for the meeting bot to function properly
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Click "Apply" after configuring all options
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge className="mt-0.5">2.3</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Test Connection</p>
                    <p className="text-sm text-muted-foreground">
                      Click "Test in Web Chat" to verify the bot responds
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Create Teams App Manifest */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline">Step 3</Badge>
                Create Teams App Manifest
              </CardTitle>
              <CardDescription>
                Configure the Teams app package with proper permissions and settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge className="mt-0.5">3.1</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Create manifest.json</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Download the pre-configured manifest or copy the template and update the highlighted values:
                    </p>
                    <div className="space-y-3">
                      <Button
                        onClick={() => downloadManifest()}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Pre-configured manifest.json
                      </Button>
                      <div className="relative">
                        <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-80">
                          <code>{manifestExample}</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="outline"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(manifestExample, "manifest")}
                        >
                          <Copy className="h-3 w-3" />
                          {copiedStep === "manifest" ? "Copied!" : "Copy"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge className="mt-0.5">3.2</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Update Required Fields</p>
                    <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 p-4 rounded-lg space-y-2 text-sm">
                      <div className="font-semibold text-orange-800 dark:text-orange-200 mb-2">⚠️ Required Updates:</div>
                      <div className="space-y-1 text-orange-900 dark:text-orange-100">
                        <p>• Replace <code className="bg-orange-100 dark:bg-orange-900 px-2 py-1 rounded text-xs font-mono">YOUR_AZURE_BOT_ID_HERE</code> with your Microsoft App ID</p>
                        <p>• Replace <code className="bg-orange-100 dark:bg-orange-900 px-2 py-1 rounded text-xs font-mono">YOUR_GENERATED_UUID_HERE</code> with a new UUID</p>
                        <p>• Update <code className="bg-orange-100 dark:bg-orange-900 px-2 py-1 rounded text-xs font-mono">developer</code> section with your company info</p>
                        <p>• Update <code className="bg-orange-100 dark:bg-orange-900 px-2 py-1 rounded text-xs font-mono">validDomains</code> with your actual domains</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge className="mt-0.5">3.3</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Create App Icons</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Download template icons or create your own:
                    </p>
                    <div className="grid md:grid-cols-2 gap-3 mb-3">
                      <Button
                        onClick={() => downloadIcon('color')}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download color.png (192x192)
                      </Button>
                      <Button
                        onClick={() => downloadIcon('outline')}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download outline.png (32x32)
                      </Button>
                    </div>
                    <ul className="text-sm space-y-1">
                      <li>• <strong>color.png:</strong> 192x192px full-color icon</li>
                      <li>• <strong>outline.png:</strong> 32x32px transparent outline</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 4: Package and Deploy */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline">Step 4</Badge>
                Package and Deploy to Teams
              </CardTitle>
              <CardDescription>
                Create the Teams app package and deploy it to your organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Badge className="mt-0.5">4.1</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Create App Package</p>
                    <p className="text-sm text-muted-foreground mb-3">
                      Download the complete app package or create manually:
                    </p>
                    <div className="space-y-3">
                      <Button
                        onClick={() => downloadAppPackage()}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Complete App Package (.zip)
                      </Button>
                      <div className="bg-muted p-3 rounded-lg text-sm">
                        <p>📦 <strong>lyfeai-meetings-assistant.zip</strong></p>
                        <p className="ml-4">├── manifest.json</p>
                        <p className="ml-4">├── color.png</p>
                        <p className="ml-4">└── outline.png</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge className="mt-0.5">4.2</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Upload to Teams Admin Center</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Go to <a href="https://admin.teams.microsoft.com" target="_blank" rel="noopener" className="text-primary underline">Teams Admin Center</a>:
                    </p>
                    <div className="space-y-1 text-sm">
                      <p>1. Navigate to "Teams apps" → "Manage apps"</p>
                      <p>2. Click "Upload new app" → "Upload"</p>
                      <p>3. Select your ZIP file and upload</p>
                      <p>4. Set permissions and approve the app</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Badge className="mt-0.5">4.3</Badge>
                  <div className="flex-1">
                    <p className="font-medium">Test the Bot</p>
                    <p className="text-sm text-muted-foreground">
                      In Teams, search for "LyfeAI Meetings Assistant" and add it to a meeting to test
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 5: Verification */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Badge variant="outline">Step 5</Badge>
                Verify Deployment
              </CardTitle>
              <CardDescription>
                Test all bot functions to ensure proper deployment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Test Checklist</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Bot appears in Teams app store</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Bot responds to direct messages</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Bot can be added to meetings</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Webhook receives meeting events</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Troubleshooting</h4>
                  <div className="text-sm space-y-1">
                    <p>• Check Azure Bot messaging endpoint</p>
                    <p>• Verify Teams channel is enabled</p>
                    <p>• Review app manifest format</p>
                    <p>• Check Supabase function logs</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resources */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Documentation Links</h4>
                  <div className="space-y-1 text-sm">
                    <a
                      href="https://docs.microsoft.com/en-us/azure/bot-service/"
                      target="_blank"
                      rel="noopener"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Azure Bot Service Docs
                    </a>
                    <a
                      href="https://docs.microsoft.com/en-us/microsoftteams/platform/"
                      target="_blank"
                      rel="noopener"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Teams Platform Docs
                    </a>
                    <a
                      href="https://docs.microsoft.com/en-us/microsoftteams/platform/bots/how-to/create-a-bot-for-teams"
                      target="_blank"
                      rel="noopener"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Teams Bot Creation Guide
                    </a>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Support</h4>
                  <div className="text-sm">
                    <p>For technical support:</p>
                    <p>• Check Supabase function logs</p>
                    <p>• Review Azure Bot service logs</p>
                    <p>• Contact your Teams administrator</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}