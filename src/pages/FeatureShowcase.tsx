import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  Brain, 
  Shield, 
  Zap, 
  Clock, 
  Users, 
  Calendar, 
  BarChart3, 
  MessageSquare, 
  Star, 
  Bot, 
  Smartphone,
  Globe,
  Lock,
  TrendingUp,
  FileText,
  Database,
  Workflow,
  Eye,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Cpu,
  Network,
  Target,
  Lightbulb,
  Gauge
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const FeatureShowcase = () => {
  const navigate = useNavigate();

  const heroFeatures = [
    {
      icon: Brain,
      title: "AI-Powered Intelligence",
      description: "Advanced machine learning algorithms that understand your email patterns"
    },
    {
      icon: Zap,
      title: "Real-Time Processing",
      description: "Lightning-fast email analysis and automated workflow execution"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Military-grade threat detection and data protection protocols"
    }
  ];

  const coreFeatures = [
    {
      category: "AI & Intelligence",
      icon: Brain,
      gradient: "from-purple-500 to-pink-500",
      features: [
        {
          icon: Bot,
          title: "AI Email Classification",
          description: "Automatically categorize emails with 99.5% accuracy using advanced machine learning models"
        },
        {
          icon: MessageSquare,
          title: "Intelligent Reply Assistant",
          description: "Generate contextual, professional email responses that match your writing style"
        },
        {
          icon: Target,
          title: "Priority Scoring",
          description: "AI-driven importance detection that prioritizes emails requiring immediate attention"
        },
        {
          icon: Lightbulb,
          title: "Smart Insights",
          description: "Real-time analysis of your email patterns with actionable recommendations"
        }
      ]
    },
    {
      category: "Workflow Automation",
      icon: Workflow,
      gradient: "from-blue-500 to-cyan-500",
      features: [
        {
          icon: Zap,
          title: "Advanced Workflow Rules",
          description: "Create complex automation rules with conditional logic and multi-step actions"
        },
        {
          icon: Calendar,
          title: "Meeting Assistant",
          description: "Automatic calendar integration with smart scheduling and conflict resolution"
        },
        {
          icon: Clock,
          title: "Email Scheduling",
          description: "Send emails at optimal times with AI-powered timing recommendations"
        },
        {
          icon: FileText,
          title: "Writing Style Analysis",
          description: "Maintain consistent communication tone across your organization"
        }
      ]
    },
    {
      category: "Security & Monitoring",
      icon: Shield,
      gradient: "from-red-500 to-orange-500",
      features: [
        {
          icon: AlertTriangle,
          title: "Threat Intelligence",
          description: "Real-time threat detection with integration to global security feeds"
        },
        {
          icon: Eye,
          title: "Email Monitoring",
          description: "Comprehensive visibility into email traffic with detailed analytics"
        },
        {
          icon: Lock,
          title: "VIP Protection",
          description: "Enhanced security protocols for high-value communications"
        },
        {
          icon: Database,
          title: "Backup & Recovery",
          description: "Automated backup systems with instant recovery capabilities"
        }
      ]
    },
    {
      category: "Analytics & Insights",
      icon: BarChart3,
      gradient: "from-green-500 to-emerald-500",
      features: [
        {
          icon: TrendingUp,
          title: "Performance Metrics",
          description: "Deep analytics on email performance, response times, and team productivity"
        },
        {
          icon: Gauge,
          title: "Real-Time Dashboard",
          description: "Live monitoring of email systems with customizable KPI tracking"
        },
        {
          icon: Users,
          title: "Team Analytics",
          description: "Comprehensive insights into team communication patterns and efficiency"
        },
        {
          icon: Smartphone,
          title: "Mobile Briefings",
          description: "AI-generated daily briefings delivered to your mobile device"
        }
      ]
    },
    {
      category: "Integration & Platform",
      icon: Network,
      gradient: "from-indigo-500 to-purple-500",
      features: [
        {
          icon: Globe,
          title: "Microsoft 365 Integration",
          description: "Seamless integration with Outlook, Teams, and the entire Microsoft ecosystem"
        },
        {
          icon: Bot,
          title: "Teams Bot Assistant",
          description: "Intelligent bot that provides email insights directly in Microsoft Teams"
        },
        {
          icon: Cpu,
          title: "Platform Assistant",
          description: "AI-powered assistant that helps you navigate and optimize the platform"
        },
        {
          icon: Users,
          title: "Enterprise User Management",
          description: "Sophisticated role-based access control and user provisioning"
        }
      ]
    }
  ];

  const stats = [
    { value: "99.5%", label: "Classification Accuracy" },
    { value: "10x", label: "Faster Email Processing" },
    { value: "80%", label: "Reduction in Manual Work" },
    { value: "24/7", label: "Continuous Protection" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="px-4 py-20 text-center">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Sparkles className="h-8 w-8 text-cyan-400 animate-pulse" />
              <Badge variant="outline" className="text-cyan-400 border-cyan-400/50 bg-cyan-400/10">
                AI-Powered Email Intelligence
              </Badge>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-bold mb-8 bg-gradient-to-r from-white via-cyan-200 to-blue-200 bg-clip-text text-transparent">
              The Future of
              <br />
              <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Email Management
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-4xl mx-auto leading-relaxed">
              Transform your email workflow with cutting-edge AI technology. Automate, secure, and optimize 
              every aspect of your email communication with our comprehensive enterprise solution.
            </p>

            <div className="flex flex-wrap justify-center gap-6 mb-16">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                onClick={() => navigate('/auth')}
              >
                Get Started Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10 px-8 py-4 text-lg font-semibold"
              >
                Watch Demo
              </Button>
            </div>

            {/* Hero Features Grid */}
            <div className="grid md:grid-cols-3 gap-8 mb-20">
              {heroFeatures.map((feature, index) => (
                <Card key={index} className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 hover:scale-105">
                  <CardContent className="p-6 text-center">
                    <feature.icon className="h-12 w-12 text-cyan-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                    <p className="text-slate-300">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-4xl md:text-5xl font-bold text-cyan-400 mb-2">{stat.value}</div>
                  <div className="text-slate-300 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Sections */}
        <section className="px-4 py-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Complete Feature Suite
              </h2>
              <p className="text-xl text-slate-300 max-w-3xl mx-auto">
                Every tool you need to revolutionize your email management, 
                powered by advanced AI and enterprise-grade security
              </p>
            </div>

            <div className="space-y-20">
              {coreFeatures.map((category, categoryIndex) => (
                <div key={categoryIndex} className="space-y-8">
                  {/* Category Header */}
                  <div className="text-center">
                    <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r ${category.gradient} bg-opacity-20 border border-white/20`}>
                      <category.icon className="h-6 w-6 text-white" />
                      <h3 className="text-2xl font-bold text-white">{category.category}</h3>
                    </div>
                  </div>

                  {/* Features Grid */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {category.features.map((feature, featureIndex) => (
                      <Card 
                        key={featureIndex} 
                        className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] group"
                      >
                        <CardHeader className="pb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-r ${category.gradient} bg-opacity-20`}>
                              <feature.icon className="h-6 w-6 text-white" />
                            </div>
                            <CardTitle className="text-white text-lg group-hover:text-cyan-300 transition-colors">
                              {feature.title}
                            </CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <CardDescription className="text-slate-300 text-base leading-relaxed">
                            {feature.description}
                          </CardDescription>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-4 py-20 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/20 rounded-3xl p-12">
              <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto mb-6" />
              <h2 className="text-4xl font-bold text-white mb-6">
                Ready to Transform Your Email Workflow?
              </h2>
              <p className="text-xl text-slate-300 mb-8">
                Join thousands of organizations already benefiting from AI-powered email intelligence.
                Get started in minutes with our comprehensive onboarding process.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                  onClick={() => navigate('/auth')}
                >
                  Start Free Trial
                  <Sparkles className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg font-semibold"
                >
                  Contact Sales
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-4 py-8 border-t border-white/10">
          <div className="max-w-6xl mx-auto text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Mail className="h-6 w-6 text-cyan-400" />
              <span className="text-xl font-bold text-white">AI Email Intelligence</span>
            </div>
            <p className="text-slate-400">
              © 2025 AI Email Intelligence. All rights reserved. | Powered by Advanced Machine Learning
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default FeatureShowcase;