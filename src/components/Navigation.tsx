import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  User, 
  LogOut, 
  Shield, 
  Settings, 
  Users,
  FileText,
  Activity,
  FolderOpen,
  Workflow,
  GitBranch,
  ChevronDown,
  Brain
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { useModules } from "@/hooks/useModules";
import { cn } from "@/lib/utils";

export const Navigation = () => {
  const { user, signOut } = useAuth();
  const { isSuperAdmin } = useRoles();
  const { hasEmailManagement, hasSecurity } = useModules();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  // Core navigation items (always visible)
  const coreMenuItems = [
    { path: '/platform-overview', label: 'Overview', icon: Activity },
    { path: '/dashboard', label: 'Dashboard', icon: Activity },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  // Email Management module items
  const emailManagementItems = [
    { path: '/email-categories', label: 'Categories', icon: FolderOpen },
    { path: '/workflows', label: 'Workflows', icon: Workflow },
    { path: '/workflow-rules', label: 'Rules', icon: GitBranch },
    { path: '/ai-classification', label: 'AI Testing', icon: Brain },
  ];

  // Security module items
  const securityItems = [
    { path: '/threat-intelligence', label: 'Threat Intelligence', icon: Shield },
    { path: '/threat-monitor', label: 'Threat Monitor', icon: Shield },
    { path: '/quarantine-test', label: 'Quarantine Test', icon: Shield },
  ];

  // Build menu items based on module access
  const standardMenuItems = [
    ...coreMenuItems,
    ...(hasEmailManagement ? emailManagementItems : []),
    ...(hasSecurity ? securityItems : []),
  ];

  const superAdminItems = [
    { path: '/admin/users', label: 'User Management', icon: Users },
    { path: '/module-management', label: 'Module Management', icon: Settings },
    { path: '/admin/diagnostics', label: 'System Diagnostics', icon: Activity },
    { path: '/admin/settings', label: 'Super Admin Settings', icon: Settings },
    { path: '/super-admin-guide', label: 'Admin Guide', icon: FileText },
  ];

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg shadow-glow-primary"></div>
            <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Lyfe Email Management
            </h1>
          </div>

          {/* Main Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {/* Standard Menu Items */}
            {standardMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center space-x-2 text-sm transition-colors hover:text-foreground",
                    isActive(item.path)
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Super Admin Section */}
            {isSuperAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "flex items-center space-x-2 text-sm transition-colors hover:text-foreground",
                      superAdminItems.some(item => isActive(item.path))
                        ? "text-foreground font-medium bg-muted"
                        : "text-muted-foreground"
                    )}
                  >
                    <Shield className="h-4 w-4" />
                    <span>Super Admin</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Administrative</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {superAdminItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem key={item.path} asChild>
                        <Link
                          to={item.path}
                          className={cn(
                            "flex items-center space-x-2 w-full cursor-pointer",
                            isActive(item.path) && "bg-muted font-medium"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Welcome, {user?.email}</span>
              {isSuperAdmin && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  Super Admin
                </span>
              )}
            </div>
            <Button onClick={signOut} variant="ghost" size="sm" className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};