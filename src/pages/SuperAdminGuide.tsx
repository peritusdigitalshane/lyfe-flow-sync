import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Shield, 
  Settings, 
  Users, 
  Bot, 
  Database,
  Mail,
  AlertTriangle,
  CheckCircle,
  Zap,
  Lock,
  Eye,
  Cog
} from "lucide-react";
import { toast } from "sonner";

export default function SuperAdminGuide() {
  const { user } = useAuth();
  const { isSuperAdmin, loading } = useRoles();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !isSuperAdmin) {
    toast.error("Access denied. Super Admin privileges required.");
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Lock className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You need Super Admin privileges to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/dashboard">
              <Button className="w-full">Return to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link to="/settings">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Settings
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <Shield className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">Super Admin Guide</h1>
                <Badge variant="destructive" className="ml-2">
                  <Lock className="h-3 w-3 mr-1" />
                  Super Admin Only
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Welcome Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Welcome to LyfeFlow - Super Admin Center
              </CardTitle>
              <CardDescription>
                Your comprehensive guide to managing the email automation platform as a Super Administrator
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                As a Super Admin, you have complete control over the platform's configuration, user management, 
                and system-wide settings. This guide will help you understand and effectively use all administrative features.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  <Shield className="h-3 w-3 mr-1" />
                  Full Access
                </Badge>
                <Badge variant="outline">
                  <Users className="h-3 w-3 mr-1" />
                  User Management
                </Badge>
                <Badge variant="outline">
                  <Settings className="h-3 w-3 mr-1" />
                  System Configuration
                </Badge>
                <Badge variant="outline">
                  <Bot className="h-3 w-3 mr-1" />
                  AI Management
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link to="/settings">
                  <Button variant="outline" className="w-full h-auto p-4 flex flex-col gap-2">
                    <Settings className="h-6 w-6" />
                    <span className="font-medium">System Settings</span>
                    <span className="text-xs text-muted-foreground">Configure system-wide settings</span>
                  </Button>
                </Link>
                <Link to="/admin/users">
                  <Button variant="outline" className="w-full h-auto p-4 flex flex-col gap-2">
                    <Users className="h-6 w-6" />
                    <span className="font-medium">User Management</span>
                    <span className="text-xs text-muted-foreground">Manage users and permissions</span>
                  </Button>
                </Link>
                <Link to="/admin/diagnostics">
                  <Button variant="outline" className="w-full h-auto p-4 flex flex-col gap-2">
                    <Database className="h-6 w-6" />
                    <span className="font-medium">System Diagnostics</span>
                    <span className="text-xs text-muted-foreground">Check system health</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* System Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cog className="h-5 w-5" />
                System Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Core Configuration Areas</h3>
                
                <div className="grid gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Mail className="h-4 w-4 text-blue-500" />
                      Email Processing Settings
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Configure how the system processes and handles incoming emails.
                    </p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Polling interval (how often to check for new emails)</li>
                      <li>• Maximum emails per polling cycle</li>
                      <li>• Auto-categorization settings</li>
                    </ul>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-green-500" />
                      Microsoft OAuth Configuration
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Set up integration with Microsoft 365 for mailbox connections.
                    </p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Azure Application Client ID</li>
                      <li>• Client Secret (encrypted storage)</li>
                      <li>• Tenant configuration</li>
                    </ul>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Bot className="h-4 w-4 text-purple-500" />
                      AI Configuration
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Configure OpenAI integration and customize AI prompts.
                    </p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• OpenAI API key and model selection</li>
                      <li>• Custom AI prompts for classification</li>
                      <li>• Threat analysis configurations</li>
                      <li>• Condition evaluator prompts</li>
                    </ul>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Quarantine System
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Advanced threat detection and email quarantine settings.
                    </p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• AI-powered threat detection</li>
                      <li>• Risk threshold configuration</li>
                      <li>• Suspicious pattern definitions</li>
                      <li>• Domain whitelist management</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Role-Based Access Control</h3>
                
                <div className="grid gap-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Super Admin</h4>
                      <Badge variant="destructive">Highest Privilege</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Complete system access with all administrative privileges.
                    </p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>• Full system configuration access</li>
                      <li>• User role management</li>
                      <li>• AI prompt customization</li>
                      <li>• System diagnostics and monitoring</li>
                    </ul>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">Admin</h4>
                      <Badge variant="secondary">Limited Admin</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Administrative access with some restrictions.
                    </p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>• User management within tenant</li>
                      <li>• Basic system monitoring</li>
                      <li>• Workflow management</li>
                    </ul>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">User</h4>
                      <Badge variant="outline">Standard Access</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Standard user with access to their own data and configurations.
                    </p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>• Mailbox management</li>
                      <li>• Email categories and rules</li>
                      <li>• Personal workflow configuration</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Prompt Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                AI Prompt Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Customize AI prompts to fine-tune the system's behavior for your organization's specific needs.
              </p>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Available AI Prompts</h3>
                
                <div className="grid gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Condition Evaluator Prompt</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Used when AI evaluates custom conditions in workflow rules.
                    </p>
                    <div className="bg-muted/50 p-3 rounded text-xs font-mono">
                      Placeholders: {"{condition}"}, {"{email_content}"}
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Threat Analysis Prompt</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Powers the cybersecurity threat analysis of incoming emails.
                    </p>
                    <div className="bg-muted/50 p-3 rounded text-xs font-mono">
                      Placeholders: {"{subject}"}, {"{sender_email}"}, {"{content}"}, {"{has_attachments}"}
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Email Classification Prompt</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Handles AI-powered email categorization based on user-defined categories.
                    </p>
                    <div className="bg-muted/50 p-3 rounded text-xs font-mono">
                      Placeholders: {"{subject}"}, {"{sender}"}, {"{content}"}, {"{categories}"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">💡 Best Practices</h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Test prompts thoroughly in a development environment</li>
                  <li>• Use specific, unambiguous language</li>
                  <li>• Include clear JSON response format requirements</li>
                  <li>• Monitor AI responses after prompt changes</li>
                  <li>• Keep backups of working prompts before modifications</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Security & Monitoring */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Security & Monitoring
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Security Features</h3>
                
                <div className="grid gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Row Level Security (RLS)
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      All database tables are protected with RLS policies ensuring users can only access their own data.
                    </p>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Lock className="h-4 w-4 text-blue-500" />
                      Encrypted Secrets
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      API keys and sensitive configuration data are encrypted and stored securely in Supabase secrets.
                    </p>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Audit Logging
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      All administrative actions and system events are logged for compliance and troubleshooting.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Monitoring Tools</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• <strong>System Diagnostics:</strong> Check overall system health and connectivity</li>
                  <li>• <strong>Edge Function Logs:</strong> Monitor AI processing and workflow execution</li>
                  <li>• <strong>Database Analytics:</strong> Query logs and performance metrics</li>
                  <li>• <strong>User Activity:</strong> Track user actions and system usage</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Troubleshooting */}
          <Card>
            <CardHeader>
              <CardTitle>Common Issues & Troubleshooting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="border-l-4 border-red-500 pl-4">
                  <h4 className="font-medium text-red-900 dark:text-red-100">Email Processing Issues</h4>
                  <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                    Check Microsoft OAuth configuration, verify API permissions, and review mailbox connection status.
                  </p>
                </div>

                <div className="border-l-4 border-yellow-500 pl-4">
                  <h4 className="font-medium text-yellow-900 dark:text-yellow-100">AI Classification Problems</h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                    Verify OpenAI API key, check model availability, and review custom prompt configurations.
                  </p>
                </div>

                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">User Access Issues</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                    Review user roles and permissions, check RLS policies, and verify tenant assignments.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Support Information */}
          <Card>
            <CardHeader>
              <CardTitle>Support & Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">Documentation</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• System Architecture Guide</li>
                    <li>• API Documentation</li>
                    <li>• Security Best Practices</li>
                    <li>• Integration Guides</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Technical Support</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• System logs and diagnostics</li>
                    <li>• Performance monitoring</li>
                    <li>• Configuration assistance</li>
                    <li>• Security reviews</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}