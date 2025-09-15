import { useAuth } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";
import { useRoles } from "@/hooks/useRoles";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Mail, 
  Shield, 
  Activity, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Settings,
  ArrowRight,
  Star
} from "lucide-react";
import { Link } from "react-router-dom";

export default function PlatformOverview() {
  const { user } = useAuth();
  const { hasEmailManagement, hasSecurity } = useModules();
  const { isSuperAdmin, isAdmin } = useRoles();

  const moduleStatus = [
    {
      id: 'email_management',
      name: 'Email Management',
      description: 'Core email automation and workflow features',
      icon: Mail,
      hasAccess: hasEmailManagement,
      features: [
        'Email Categories & Classification',
        'Workflow Automation',
        'AI-Powered Email Analysis', 
        'Microsoft Graph Integration',
        'Real-time Email Monitoring'
      ],
      color: 'primary',
    },
    {
      id: 'security',
      name: 'Security Module',
      description: 'Advanced security monitoring and threat intelligence',
      icon: Shield,
      hasAccess: hasSecurity,
      features: [
        'Threat Intelligence Feeds',
        'Real-time Threat Monitoring',
        'Email Quarantine Testing',
        'Security Analytics Dashboard',
        'Compliance Reporting'
      ],
      color: 'destructive',
    },
  ];

  const completionPercentage = moduleStatus.filter(m => m.hasAccess).length / moduleStatus.length * 100;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Platform Overview</h1>
              <p className="text-muted-foreground mt-2">
                Welcome to your professional Email Management and Security Platform
              </p>
            </div>
            
            <Badge variant="outline" className="text-lg px-4 py-2">
              {completionPercentage}% Platform Access
            </Badge>
          </div>
          
          <div className="mt-4">
            <Progress value={completionPercentage} className="h-2" />
          </div>
        </div>

        {/* Platform Status */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {moduleStatus.map((module) => {
            const Icon = module.icon;
            
            return (
              <Card key={module.id} className="card-neon">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        module.hasAccess 
                          ? 'bg-status-success/20 text-status-success' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {module.name}
                          {module.hasAccess && <CheckCircle className="h-4 w-4 text-status-success" />}
                        </CardTitle>
                        <CardDescription>{module.description}</CardDescription>
                      </div>
                    </div>
                    
                    <Badge variant={module.hasAccess ? "default" : "secondary"}>
                      {module.hasAccess ? "Active" : "Not Available"}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Module Features:</h4>
                    <ul className="space-y-2">
                      {module.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                          {module.hasAccess ? (
                            <CheckCircle className="h-3 w-3 text-status-success flex-shrink-0" />
                          ) : (
                            <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className={module.hasAccess ? '' : 'text-muted-foreground'}>
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                    
                    {!module.hasAccess && (
                      <div className="pt-3 border-t">
                        <p className="text-sm text-muted-foreground mb-2">
                          Contact your administrator to request access to this module.
                        </p>
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/settings">
                            Request Access <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <Mail className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {hasEmailManagement ? "✓" : "—"}
              </p>
              <p className="text-sm text-muted-foreground">Email Management</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Shield className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {hasSecurity ? "✓" : "—"}
              </p>
              <p className="text-sm text-muted-foreground">Security Module</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 text-accent mx-auto mb-2" />
              <p className="text-2xl font-bold">
                {isSuperAdmin ? "Super" : isAdmin ? "Admin" : "User"}
              </p>
              <p className="text-sm text-muted-foreground">Access Level</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Activity className="h-8 w-8 text-brand-secondary mx-auto mb-2" />
              <p className="text-2xl font-bold">{Math.round(completionPercentage)}%</p>
              <p className="text-sm text-muted-foreground">Platform Access</p>
            </CardContent>
          </Card>
        </div>

        {/* Admin Actions */}
        {(isSuperAdmin || isAdmin) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Administrative Actions
              </CardTitle>
              <CardDescription>
                Manage platform modules and user access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {isSuperAdmin && (
                  <>
                    <Button asChild variant="default">
                      <Link to="/module-management">
                        <Users className="h-4 w-4 mr-2" />
                        Module Management
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/admin/users">
                        <Users className="h-4 w-4 mr-2" />
                        User Management
                      </Link>
                    </Button>
                  </>
                )}
                <Button asChild variant="outline">
                  <Link to="/admin/diagnostics">
                    <Activity className="h-4 w-4 mr-2" />
                    System Diagnostics
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Welcome Message */}
        <Card className="mt-8 bg-gradient-to-r from-primary/10 via-accent/5 to-brand-secondary/10 border-primary/20">
          <CardContent className="p-6 text-center">
            <Star className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Welcome to Your Professional Platform</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              You're now using a comprehensive Email Management and Security Platform. 
              Navigate through your available modules using the menu above, or contact your 
              administrator to request additional module access.
            </p>
            <div className="mt-6">
              <Button asChild size="lg" className="gap-2">
                <Link to={hasEmailManagement ? "/dashboard" : "/settings"}>
                  {hasEmailManagement ? "Go to Dashboard" : "Get Started"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}