import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Shield, Zap, Settings, Users, Activity, ArrowRight, CheckCircle } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-surface-secondary">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-brand-gradient flex items-center justify-center">
                <Mail className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-brand-primary">Lyfe Email Management</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost">
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button asChild variant="brand">
                <Link to="/auth">Get Started</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-4">
            Multi-tenant Email Automation Platform
          </Badge>
          <h2 className="text-4xl lg:text-6xl font-bold text-brand-primary mb-6">
            Automate Your Email
            <br />
            <span className="text-brand-secondary">Workflow Management</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Connect multiple mailboxes, set up intelligent automation rules, and manage your email workflow with n8n integration and Microsoft Graph.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button asChild variant="brand" size="lg" className="gap-2">
              <Link to="/auth">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="brand-outline" size="lg">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 bg-surface">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-brand-primary mb-4">
              Everything You Need for Email Management
            </h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed for teams and organisations that need sophisticated email automation.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="shadow-brand-md hover:shadow-brand-lg transition-shadow">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-brand-secondary/10 flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-brand-secondary" />
                </div>
                <CardTitle>Multi-Mailbox Support</CardTitle>
                <CardDescription>
                  Connect and manage multiple Microsoft 365 mailboxes with isolated workflows and credentials.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-brand-md hover:shadow-brand-lg transition-shadow">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-status-success/10 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-status-success" />
                </div>
                <CardTitle>n8n Workflow Automation</CardTitle>
                <CardDescription>
                  Automated workflow cloning and synchronisation with your self-hosted n8n instance.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-brand-md hover:shadow-brand-lg transition-shadow">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-status-warning/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-status-warning" />
                </div>
                <CardTitle>Enterprise Security</CardTitle>
                <CardDescription>
                  Multi-tenant architecture with RLS policies and secure server-side credential management.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-brand-md hover:shadow-brand-lg transition-shadow">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-status-info/10 flex items-center justify-center mb-4">
                  <Settings className="h-6 w-6 text-status-info" />
                </div>
                <CardTitle>Intelligent Rules</CardTitle>
                <CardDescription>
                  Configure email organisation rules, VIP senders, quarantine settings, and custom categories.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-brand-md hover:shadow-brand-lg transition-shadow">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-brand-accent/10 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-brand-accent" />
                </div>
                <CardTitle>Team Collaboration</CardTitle>
                <CardDescription>
                  Shared mailbox support with delegated access and team-based configuration management.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="shadow-brand-md hover:shadow-brand-lg transition-shadow">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center mb-4">
                  <Activity className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle>Activity Monitoring</CardTitle>
                <CardDescription>
                  Real-time activity logs, workflow status monitoring, and comprehensive audit trails.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-brand-gradient">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Email Management?
          </h3>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Get started with Lyfe Email Management today and experience the power of automated email workflows.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button asChild variant="secondary" size="lg" className="gap-2">
              <Link to="/auth">
                Start Your Free Trial <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="text-white border-white hover:bg-white hover:text-brand-primary">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Features List */}
      <section className="py-16 bg-surface">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-brand-primary mb-8 text-center">
              Key Features & Capabilities
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-status-success mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-brand-primary">One-Click OAuth Setup</h4>
                    <p className="text-muted-foreground text-sm">Seamless Microsoft Graph integration with secure credential management</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-status-success mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-brand-primary">Workflow Template Library</h4>
                    <p className="text-muted-foreground text-sm">Pre-built templates for common email management scenarios</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-status-success mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-brand-primary">Real-Time Synchronisation</h4>
                    <p className="text-muted-foreground text-sm">Instant config updates pushed to n8n workflows</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-status-success mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-brand-primary">Pause/Resume Controls</h4>
                    <p className="text-muted-foreground text-sm">Granular workflow control with testing capabilities</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-status-success mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-brand-primary">Audit & Activity Logs</h4>
                    <p className="text-muted-foreground text-sm">Comprehensive logging with webhook integration</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-status-success mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-brand-primary">Australian English UI</h4>
                    <p className="text-muted-foreground text-sm">Localised interface with clear error handling</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-brand-gradient flex items-center justify-center">
                <Mail className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm text-muted-foreground">Lyfe Email Management</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Built with Next.js, Supabase & n8n
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;