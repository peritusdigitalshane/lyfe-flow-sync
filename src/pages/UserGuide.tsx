import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Mail, 
  Tag, 
  Workflow, 
  Plus,
  Settings,
  Bot,
  Shield,
  CheckCircle,
  ArrowRight,
  BookOpen,
  Lightbulb,
  Target,
  Zap
} from "lucide-react";

export default function UserGuide() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Required</CardTitle>
            <CardDescription>
              Please sign in to access the user guide.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/auth">
              <Button className="w-full">Sign In</Button>
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
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <BookOpen className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold">User Guide</h1>
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
                Welcome to LyfeFlow
              </CardTitle>
              <CardDescription>
                Your complete guide to automating and organizing your email workflow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                LyfeFlow is an AI-powered platform that helps you automatically categorize, 
                organize, and manage your emails. This guide will walk you through all the features 
                and help you get the most out of your email automation.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  <Bot className="h-3 w-3 mr-1" />
                  AI-Powered
                </Badge>
                <Badge variant="outline">
                  <Mail className="h-3 w-3 mr-1" />
                  Email Automation
                </Badge>
                <Badge variant="outline">
                  <Tag className="h-3 w-3 mr-1" />
                  Smart Categorization
                </Badge>
                <Badge variant="outline">
                  <Workflow className="h-3 w-3 mr-1" />
                  Custom Rules
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Getting Started */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Getting Started
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Step-by-Step Setup</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                      1
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-2">Connect Your Mailbox</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Start by connecting your Microsoft 365 or Outlook email account to the platform.
                      </p>
                      <Link to="/add-mailbox">
                        <Button size="sm" className="gap-2">
                          <Plus className="h-4 w-4" />
                          Add Mailbox
                        </Button>
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                      2
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-2">Set Up Email Categories</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Create custom categories to organize your emails (e.g., "Important", "Newsletters", "Invoices").
                      </p>
                      <Link to="/email-categories">
                        <Button size="sm" variant="outline" className="gap-2">
                          <Tag className="h-4 w-4" />
                          Manage Categories
                        </Button>
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                      3
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-2">Create Workflow Rules</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Set up automated rules to categorize emails based on sender, subject, content, or AI analysis.
                      </p>
                      <Link to="/workflow-rules">
                        <Button size="sm" variant="outline" className="gap-2">
                          <Workflow className="h-4 w-4" />
                          Create Rules
                        </Button>
                      </Link>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      <CheckCircle className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium mb-2">Monitor & Optimize</h4>
                      <p className="text-sm text-muted-foreground">
                        Review your email processing results and fine-tune your categories and rules for better accuracy.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Core Features */}
          <Card>
            <CardHeader>
              <CardTitle>Core Features</CardTitle>
              <CardDescription>
                Explore the powerful features that make email management effortless
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Mail className="h-4 w-4 text-blue-500" />
                      Mailbox Management
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Connect and manage multiple email accounts in one place.
                    </p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>• Microsoft 365 / Outlook integration</li>
                      <li>• Real-time email synchronization</li>
                      <li>• Secure OAuth authentication</li>
                      <li>• Multiple mailbox support</li>
                    </ul>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-green-500" />
                      Smart Categorization
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Automatically organize emails into custom categories.
                    </p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>• Custom category creation</li>
                      <li>• Color-coded organization</li>
                      <li>• Priority-based sorting</li>
                      <li>• Bulk categorization</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Workflow className="h-4 w-4 text-purple-500" />
                      Workflow Automation
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Create powerful rules to automate email processing.
                    </p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>• Rule-based automation</li>
                      <li>• Condition-based triggers</li>
                      <li>• Custom actions and responses</li>
                      <li>• Advanced filtering options</li>
                    </ul>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Bot className="h-4 w-4 text-orange-500" />
                      AI-Powered Analysis
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Leverage artificial intelligence for smart email handling.
                    </p>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                      <li>• Intelligent categorization</li>
                      <li>• Threat detection and quarantine</li>
                      <li>• Content analysis</li>
                      <li>• Spam and phishing protection</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Categories Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Managing Email Categories
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Categories are the foundation of your email organization. Here's how to make the most of them:
              </p>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Creating Effective Categories</h3>
                
                <div className="grid gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Best Practices</h4>
                    <ul className="text-sm space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span><strong>Be Specific:</strong> Use clear, descriptive names like "Client Communications" instead of "Work"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span><strong>Use Colors Wisely:</strong> Assign distinct colors to help visually identify categories</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span><strong>Set Priorities:</strong> Higher priority categories are checked first during classification</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span><strong>Start Simple:</strong> Begin with 5-10 categories and expand as needed</span>
                      </li>
                    </ul>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Common Category Examples</h4>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Business</p>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                          <li>• Client Communications</li>
                          <li>• Internal Meetings</li>
                          <li>• Project Updates</li>
                          <li>• Invoices & Billing</li>
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Personal</p>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                          <li>• Newsletters</li>
                          <li>• Online Shopping</li>
                          <li>• Social Media</li>
                          <li>• Banking & Finance</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workflow Rules Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Workflow className="h-5 w-5" />
                Creating Workflow Rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Workflow rules automate your email processing by applying actions when specific conditions are met.
              </p>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Rule Components</h3>
                
                <div className="grid gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Conditions</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Define when a rule should trigger based on email properties.
                    </p>
                    <div className="grid gap-2 md:grid-cols-2 text-xs">
                      <div>
                        <p className="font-medium mb-1">Email Fields</p>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• Subject line</li>
                          <li>• Sender email</li>
                          <li>• Body content</li>
                          <li>• Has attachments</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium mb-1">AI Analysis</p>
                        <ul className="space-y-1 text-muted-foreground">
                          <li>• Risk score</li>
                          <li>• Content category</li>
                          <li>• Custom AI conditions</li>
                          <li>• Threat level</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Actions</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Specify what happens when conditions are met.
                    </p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• <strong>Categorize:</strong> Assign email to a specific category</li>
                      <li>• <strong>Quarantine:</strong> Move suspicious emails to quarantine</li>
                      <li>• <strong>Mark as Read:</strong> Automatically mark emails as read</li>
                      <li>• <strong>Send Notification:</strong> Alert users about important emails</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">💡 Rule Examples</h4>
                  <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                    <p><strong>Newsletter Rule:</strong> If sender contains "newsletter" → Categorize as "Newsletters"</p>
                    <p><strong>Client Rule:</strong> If sender domain equals "importantclient.com" → Categorize as "High Priority"</p>
                    <p><strong>Invoice Rule:</strong> If subject contains "invoice" OR "payment" → Categorize as "Billing"</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Features */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security & Privacy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your email security and privacy are our top priorities. Here's how we protect your data:
              </p>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Email Security
                  </h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• OAuth authentication (no password storage)</li>
                    <li>• Encrypted data transmission</li>
                    <li>• AI-powered threat detection</li>
                    <li>• Automatic quarantine of suspicious emails</li>
                  </ul>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Data Privacy
                  </h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Your data stays in your tenant</li>
                    <li>• Row-level security on all tables</li>
                    <li>• No email content sharing with third parties</li>
                    <li>• Regular security audits</li>
                  </ul>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">🔒 Privacy Commitment</h4>
                <p className="text-sm text-green-800 dark:text-green-200">
                  We process your emails only to provide categorization and automation services. 
                  Your email content is never stored permanently or used for any purpose other than 
                  the specific processing you've configured.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tips & Best Practices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Tips & Best Practices
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Start Small, Scale Up</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                    Begin with a few essential categories and simple rules. Add complexity as you become more comfortable with the system.
                  </p>
                </div>

                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-medium text-green-900 dark:text-green-100">Review and Refine</h4>
                  <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                    Regularly check your categorization results and adjust rules as needed. The AI learns from your corrections.
                  </p>
                </div>

                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-medium text-purple-900 dark:text-purple-100">Use AI Wisely</h4>
                  <p className="text-sm text-purple-800 dark:text-purple-200 mt-1">
                    Combine rule-based automation with AI analysis for the best results. Rules handle predictable patterns, AI handles edge cases.
                  </p>
                </div>

                <div className="border-l-4 border-orange-500 pl-4">
                  <h4 className="font-medium text-orange-900 dark:text-orange-100">Monitor Performance</h4>
                  <p className="text-sm text-orange-800 dark:text-orange-200 mt-1">
                    Keep an eye on your mailbox activity and processing results to ensure everything is working as expected.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Ready to Get Started?</CardTitle>
              <CardDescription>
                Jump into the main features to begin automating your email workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <Link to="/add-mailbox">
                  <Button variant="outline" className="w-full h-auto p-4 flex flex-col gap-2">
                    <Plus className="h-6 w-6" />
                    <span className="font-medium">Add Mailbox</span>
                    <span className="text-xs text-muted-foreground">Connect your email account</span>
                  </Button>
                </Link>
                <Link to="/email-categories">
                  <Button variant="outline" className="w-full h-auto p-4 flex flex-col gap-2">
                    <Tag className="h-6 w-6" />
                    <span className="font-medium">Create Categories</span>
                    <span className="text-xs text-muted-foreground">Organize your emails</span>
                  </Button>
                </Link>
                <Link to="/workflow-rules">
                  <Button variant="outline" className="w-full h-auto p-4 flex flex-col gap-2">
                    <Workflow className="h-6 w-6" />
                    <span className="font-medium">Setup Rules</span>
                    <span className="text-xs text-muted-foreground">Automate processing</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}