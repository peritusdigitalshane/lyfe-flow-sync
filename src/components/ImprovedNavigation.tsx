import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Brain,
  Menu,
  Mail,
  Home,
  Lock,
  Crown,
  ChevronRight
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
import { useState } from "react";

interface NavigationSection {
  title: string;
  items: {
    path: string;
    label: string;
    icon: any;
    description?: string;
    badge?: string;
  }[];
  requiresModule?: 'email_management' | 'security';
  requiresRole?: string;
}

export const ImprovedNavigation = () => {
  const { user, signOut } = useAuth();
  const { isSuperAdmin, isAdmin } = useRoles();
  const { hasEmailManagement, hasSecurity } = useModules();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isInSection = (paths: string[]) => paths.some(path => location.pathname.startsWith(path));

  // Core navigation sections
  const navigationSections: NavigationSection[] = [
    {
      title: "Dashboard",
      items: [
        { path: '/platform-overview', label: 'Platform Overview', icon: Home, description: 'Module status and platform summary' },
        { path: '/dashboard', label: 'Dashboard', icon: Activity, description: 'Main dashboard and mailbox overview' },
      ]
    },
    {
      title: "Email Management",
      requiresModule: 'email_management',
      items: [
        { path: '/email-categories', label: 'Categories', icon: FolderOpen, description: 'Organize and classify emails' },
        { path: '/workflows', label: 'Workflows', icon: Workflow, description: 'Automate email processing' },
        { path: '/workflow-rules', label: 'Rules', icon: GitBranch, description: 'Configure workflow conditions' },
        { path: '/ai-classification', label: 'AI Testing', icon: Brain, description: 'Test AI email classification' },
      ]
    },
    {
      title: "Security",
      requiresModule: 'security',
      items: [
        { path: '/threat-intelligence', label: 'Threat Intelligence', icon: Shield, description: 'Security feed management' },
        { path: '/threat-monitor', label: 'Threat Monitor', icon: Shield, description: 'Real-time security monitoring' },
        { path: '/quarantine-test', label: 'Quarantine Test', icon: Lock, description: 'Test email security features' },
      ]
    },
    {
      title: "Administration",
      requiresRole: 'admin',
      items: [
        ...(isSuperAdmin ? [
          { path: '/admin/users', label: 'User Management', icon: Users, description: 'Manage platform users' },
          { path: '/module-management', label: 'Module Management', icon: Settings, description: 'Assign user modules', badge: 'New' },
          { path: '/admin/settings', label: 'Admin Settings', icon: Settings, description: 'Platform configuration' },
        ] : []),
        { path: '/admin/diagnostics', label: 'System Diagnostics', icon: Activity, description: 'System health monitoring' },
      ]
    }
  ];

  // Filter sections based on module access and roles
  const visibleSections = navigationSections.filter(section => {
    if (section.requiresModule && !hasEmailManagement && section.requiresModule === 'email_management') return false;
    if (section.requiresModule && !hasSecurity && section.requiresModule === 'security') return false;
    if (section.requiresRole === 'admin' && !isAdmin && !isSuperAdmin) return false;
    return section.items.length > 0;
  });

  const renderNavigationItems = (section: NavigationSection, isMobile = false) => {
    const Icon = section.requiresModule === 'email_management' ? Mail : 
                section.requiresModule === 'security' ? Shield :
                section.requiresRole === 'admin' ? Crown : Activity;

    if (isMobile) {
      return (
        <div key={section.title} className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground">
            <Icon className="h-4 w-4" />
            {section.title}
            {section.requiresModule && (
              <Badge variant="outline" className="text-xs">
                {section.requiresModule === 'email_management' ? 'Standard' : 'Premium'}
              </Badge>
            )}
          </div>
          {section.items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-6 py-2 text-sm transition-colors hover:bg-muted rounded-md mx-2",
                  isActive(item.path) ? "bg-primary text-primary-foreground" : "hover:text-foreground"
                )}
              >
                <ItemIcon className="h-4 w-4" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {item.label}
                    {item.badge && <Badge variant="secondary" className="text-xs">{item.badge}</Badge>}
                  </div>
                  {item.description && (
                    <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
                  )}
                </div>
              </Link>
            );
          })}
          {section !== visibleSections[visibleSections.length - 1] && <Separator className="my-2" />}
        </div>
      );
    }

    // Desktop dropdown
    if (section.items.length === 1) {
      const item = section.items[0];
      const ItemIcon = item.icon;
      return (
        <Link
          key={item.path}
          to={item.path}
          className={cn(
            "flex items-center space-x-2 text-sm transition-colors hover:text-foreground px-2 py-1 rounded-md",
            isActive(item.path) ? "text-foreground font-medium bg-muted" : "text-muted-foreground"
          )}
        >
          <ItemIcon className="h-4 w-4" />
          <span>{item.label}</span>
        </Link>
      );
    }

    return (
      <DropdownMenu key={section.title}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex items-center space-x-2 text-sm transition-colors hover:text-foreground",
              isInSection(section.items.map(i => i.path))
                ? "text-foreground font-medium bg-muted"
                : "text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{section.title}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          className="w-64 bg-card border-border shadow-lg backdrop-blur-sm z-50"
        >
          <DropdownMenuLabel className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {section.title}
            {section.requiresModule && (
              <Badge variant="outline" className="text-xs">
                {section.requiresModule === 'email_management' ? 'Standard' : 'Premium'}
              </Badge>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {section.items.map((item) => {
            const ItemIcon = item.icon;
            return (
              <DropdownMenuItem key={item.path} asChild>
                <Link
                  to={item.path}
                  className={cn(
                    "flex items-start space-x-3 w-full cursor-pointer p-3",
                    isActive(item.path) && "bg-muted font-medium"
                  )}
                >
                  <ItemIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.label}</span>
                      {item.badge && <Badge variant="secondary" className="text-xs">{item.badge}</Badge>}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <Link to="/platform-overview" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg shadow-glow-primary"></div>
            <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Lyfe Email Management
            </h1>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {visibleSections.map(section => renderNavigationItems(section, false))}
          </nav>

          {/* Right Side */}
          <div className="flex items-center space-x-4">
            {/* Module Status Indicator */}
            <div className="hidden md:flex items-center space-x-2">
              {hasEmailManagement && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  <Mail className="h-3 w-3 mr-1" />
                  Email
                </Badge>
              )}
              {hasSecurity && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                  <Shield className="h-3 w-3 mr-1" />
                  Security
                </Badge>
              )}
            </div>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline max-w-32 truncate">{user?.email}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border shadow-lg z-50">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.email}</p>
                    {isSuperAdmin && (
                      <Badge variant="outline" className="w-fit text-xs">
                        <Crown className="h-3 w-3 mr-1" />
                        Super Admin
                      </Badge>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 bg-card border-border">
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-center space-x-2 pb-4 border-b">
                    <div className="w-6 h-6 bg-gradient-primary rounded-md"></div>
                    <span className="font-bold text-lg">Navigation</span>
                  </div>

                  {/* Navigation Sections */}
                  <div className="flex-1 overflow-y-auto py-4 space-y-1">
                    {visibleSections.map(section => renderNavigationItems(section, true))}
                  </div>

                  {/* Footer */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span className="text-sm truncate max-w-32">{user?.email}</span>
                      </div>
                      <Button
                        onClick={signOut}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};