import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Zap, Shield, Settings } from "lucide-react";

export default function Index() {
  return (
    <div className="min-h-screen bg-animated">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg shadow-glow-primary"></div>
            <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Lyfe Email Management
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="hover:text-primary">
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild variant="neon" size="lg">
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="container mx-auto px-4 text-center py-20">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="animate-fade-in">
            <span className="inline-block px-4 py-2 rounded-full bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow-primary mb-6">
              ✨ Next-Generation Email Automation
            </span>
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent leading-tight">
              Revolutionise Your Email
              <br />
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Workflow Management
              </span>
            </h1>
            <p className="text-xl text-muted-foreground mt-6 max-w-2xl mx-auto">
              Harness AI-powered automation with Microsoft Graph integration and intelligent workflow orchestration. Transform chaos into seamless productivity.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 animate-scale-in">
            <Button asChild variant="premium" size="xl" className="gap-2 font-semibold">
              <Link to="/auth">
                Start Free Trial <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="brand-outline" size="xl" className="font-semibold">
              Watch Demo
            </Button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-8 mt-20 animate-fade-in">
          <div className="card-neon p-8 rounded-xl border border-border/50 hover:border-primary/50 transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-primary rounded-lg shadow-glow-primary mb-4 flex items-center justify-center">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-4 text-foreground">Intelligent Automation</h3>
            <p className="text-muted-foreground">
              Advanced AI algorithms learn your email patterns and automate complex workflows with precision and reliability.
            </p>
          </div>

          <div className="card-neon p-8 rounded-xl border border-border/50 hover:border-accent/50 transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-secondary rounded-lg shadow-glow-secondary mb-4 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-4 text-foreground">Enterprise Security</h3>
            <p className="text-muted-foreground">
              Bank-grade encryption, multi-tenant architecture, and comprehensive audit trails protect your sensitive communications.
            </p>
          </div>

          <div className="card-neon p-8 rounded-xl border border-border/50 hover:border-brand-accent/50 transition-all duration-300">
            <div className="w-12 h-12 bg-gradient-to-r from-brand-accent to-primary rounded-lg shadow-glow-accent mb-4 flex items-center justify-center">
              <Settings className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-4 text-foreground">Seamless Integration</h3>
            <p className="text-muted-foreground">
              Native Microsoft Graph connectivity with real-time synchronisation and powerful n8n workflow orchestration.
            </p>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid md:grid-cols-4 gap-8 mt-20 p-8 rounded-2xl bg-gradient-neon border border-border/30 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary mb-2">99.9%</div>
            <div className="text-sm text-muted-foreground">Uptime Reliability</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-accent mb-2">500K+</div>
            <div className="text-sm text-muted-foreground">Emails Processed</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-brand-secondary mb-2">80%</div>
            <div className="text-sm text-muted-foreground">Time Savings</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-brand-accent mb-2">24/7</div>
            <div className="text-sm text-muted-foreground">Global Support</div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-20 p-12 rounded-2xl bg-gradient-subtle border border-border/30 backdrop-blur-sm text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            Ready to Transform Your Email Workflow?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of professionals who've revolutionised their email management with our cutting-edge automation platform.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button asChild variant="premium" size="xl" className="gap-2 font-semibold">
              <Link to="/auth">
                Start Your Free Trial <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="brand-outline" size="xl" className="font-semibold">
              Contact Sales
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-muted-foreground">
            <p>&copy; 2024 Lyfe Email Management. Transforming productivity through intelligent automation.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}