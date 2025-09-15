import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const routeLabels: Record<string, string> = {
  'platform-overview': 'Platform Overview',
  'dashboard': 'Dashboard',
  'email-categories': 'Email Categories',
  'workflows': 'Workflows',
  'workflow-rules': 'Workflow Rules',
  'ai-classification': 'AI Classification',
  'threat-intelligence': 'Threat Intelligence',
  'threat-monitor': 'Threat Monitor',
  'quarantine-test': 'Quarantine Test',
  'module-management': 'Module Management',
  'admin': 'Administration',
  'users': 'User Management',
  'settings': 'Settings',
  'diagnostics': 'System Diagnostics',
  'mailbox': 'Mailbox',
  'activity': 'Activity',
  'auth': 'Authentication',
  'add-mailbox': 'Add Mailbox',
  'email-monitoring': 'Email Monitoring',
  'user-guide': 'User Guide',
  'super-admin-guide': 'Admin Guide',
  'performance-metrics': 'Performance Metrics',
};

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  if (pathSegments.length === 0 || location.pathname === '/') {
    return null;
  }

  const breadcrumbItems: BreadcrumbItem[] = [
    {
      label: 'Home',
      path: '/platform-overview',
      icon: Home,
    }
  ];

  let currentPath = '';
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    
    breadcrumbItems.push({
      label,
      path: index === pathSegments.length - 1 ? undefined : currentPath,
    });
  });

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center space-x-2 text-sm text-muted-foreground">
        {breadcrumbItems.map((item, index) => {
          const Icon = item.icon;
          const isLast = index === breadcrumbItems.length - 1;

          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground/50" />
              )}
              
              {item.path ? (
                <Link
                  to={item.path}
                  className={cn(
                    "flex items-center gap-1 hover:text-foreground transition-colors",
                    index === 0 && "text-primary hover:text-primary"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.label}
                </Link>
              ) : (
                <span className={cn(
                  "flex items-center gap-1",
                  isLast && "text-foreground font-medium"
                )}>
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};