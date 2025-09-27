import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Brain, Shield, Zap, ArrowRight, Sparkles, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="px-4 py-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-8 w-8 text-cyan-400" />
              <span className="text-2xl font-bold text-white">AI Email Intelligence</span>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                className="text-white hover:text-cyan-400"
                onClick={() => navigate('/features')}
              >
                <Eye className="h-4 w-4 mr-2" />
                View All Features
              </Button>
              <Button 
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                onClick={() => navigate('/auth')}
              >
                Get Started
              </Button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="px-4 py-20 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Sparkles className="h-8 w-8 text-cyan-400 animate-pulse" />
              <Badge variant="outline" className="text-cyan-400 border-cyan-400/50 bg-cyan-400/10">
                Next-Generation Email Management
              </Badge>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-8 bg-gradient-to-r from-white via-cyan-200 to-blue-200 bg-clip-text text-transparent">
              Revolutionize Your
              <br />
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Email Workflow
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              Experience the power of AI-driven email intelligence. Automate workflows, 
              enhance security, and boost productivity with our comprehensive enterprise solution.
            </p>

            <div className="flex flex-wrap justify-center gap-6 mb-16">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                onClick={() => navigate('/auth')}
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10 px-8 py-4 text-lg font-semibold"
                onClick={() => navigate('/features')}
              >
                <Eye className="mr-2 h-5 w-5" />
                Explore Features
              </Button>
            </div>

            {/* Quick Feature Highlights */}
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <Brain className="h-10 w-10 text-purple-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-white mb-2">AI Intelligence</h3>
                <p className="text-slate-400 text-sm">Advanced machine learning for smart email processing</p>
              </div>
              <div className="text-center">
                <Zap className="h-10 w-10 text-yellow-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-white mb-2">Real-Time</h3>
                <p className="text-slate-400 text-sm">Lightning-fast automated workflow execution</p>
              </div>
              <div className="text-center">
                <Shield className="h-10 w-10 text-green-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-white mb-2">Enterprise Security</h3>
                <p className="text-slate-400 text-sm">Military-grade threat detection and protection</p>
              </div>
              <div className="text-center">
                <Mail className="h-10 w-10 text-blue-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-white mb-2">Complete Suite</h3>
                <p className="text-slate-400 text-sm">Everything you need for email management</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-4 py-8 border-t border-white/10">
          <div className="max-w-6xl mx-auto text-center">
            <p className="text-slate-400">
              © 2025 AI Email Intelligence. Transforming email management with cutting-edge AI technology.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}