import React from 'react';
import { useModules } from '@/hooks/useModules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Shield, Mail, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type UserModule = Database['public']['Enums']['user_module'];

interface ModuleGuardProps {
  children: React.ReactNode;
  requiredModule: UserModule;
  fallback?: React.ReactNode;
}

const moduleInfo = {
  email_management: {
    name: 'Email Management',
    description: 'Access email categories, workflows, AI classification, and mailbox settings',
    icon: Mail,
    color: 'text-primary',
  },
  security: {
    name: 'Security Module',
    description: 'Access threat intelligence, security monitoring, and advanced security features',
    icon: Shield,
    color: 'text-destructive',
  },
  teams: {
    name: 'Teams Integration',
    description: 'Access Microsoft Teams meeting intelligence, summaries, and analytics',
    icon: Video,
    color: 'text-blue-600',
  },
};

export const ModuleGuard: React.FC<ModuleGuardProps> = ({ 
  children, 
  requiredModule, 
  fallback 
}) => {
  const { hasModuleAccess, loading } = useModules();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Checking module access...</p>
        </div>
      </div>
    );
  }

  if (!hasModuleAccess(requiredModule)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    const info = moduleInfo[requiredModule];
    const Icon = info.icon;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center`}>
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="flex items-center justify-center gap-2">
              <Icon className={`h-5 w-5 ${info.color}`} />
              {info.name} Required
            </CardTitle>
            <CardDescription className="text-left">
              {info.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This feature requires the {info.name} module. Please contact your administrator to request access.
              </p>
              <div className="flex gap-2 justify-center">
                <Button asChild variant="outline">
                  <Link to="/dashboard">Return to Dashboard</Link>
                </Button>
                <Button asChild variant="default">
                  <Link to="/settings">Contact Support</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};