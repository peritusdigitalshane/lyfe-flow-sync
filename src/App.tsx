import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import AccountStatusCheck from "@/components/AccountStatusCheck";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import AddMailbox from "./pages/AddMailbox";
import MailboxSettings from "./pages/MailboxSettings";
import MailboxActivity from "./pages/MailboxActivity";
import EmailCategories from "./pages/EmailCategories";
import EmailMonitoring from "./pages/EmailMonitoring";
import WorkflowManagement from "./pages/WorkflowManagement";
import WorkflowRules from "./pages/WorkflowRules";
import AuthCallback from "./pages/AuthCallback";
import Settings from "./pages/Settings";
import AIClassification from "./pages/AIClassification";
import AdminDiagnostics from "./pages/AdminDiagnostics";
import UserManagement from "./pages/UserManagement";
import QuarantineTest from "./pages/QuarantineTest";
import SuperAdminGuide from "./pages/SuperAdminGuide";
import SuperAdminSettings from "./pages/SuperAdminSettings";
import UserGuide from "./pages/UserGuide";
import ThreatIntelligence from "./pages/ThreatIntelligence";
import ThreatMonitor from "./pages/ThreatMonitor";
import ModuleManagement from "./pages/ModuleManagement";
import PlatformOverview from "./pages/PlatformOverview";
import PerformanceMetrics from "./pages/PerformanceMetrics";
import TeamsOverview from "./pages/TeamsOverview";
import TeamsSettings from "./pages/TeamsSettings";
import TeamsBotGuide from "./pages/TeamsBotGuide";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ModuleGuard } from "./components/ModuleGuard";
import PlatformAssistant from "./components/PlatformAssistant";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ImpersonationBanner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={
              <AccountStatusCheck>
                <Dashboard />
              </AccountStatusCheck>
            } />
            <Route path="/platform-overview" element={
              <AccountStatusCheck>
                <PlatformOverview />
              </AccountStatusCheck>
            } />
            <Route path="/performance-metrics" element={
              <AccountStatusCheck>
                <PerformanceMetrics />
              </AccountStatusCheck>
            } />
            <Route path="/add-mailbox" element={
              <AccountStatusCheck>
                <AddMailbox />
              </AccountStatusCheck>
            } />
            <Route path="/mailbox/:mailboxId/settings" element={
              <AccountStatusCheck>
                <MailboxSettings />
              </AccountStatusCheck>
            } />
            <Route path="/mailbox/:mailboxId/activity" element={
              <AccountStatusCheck>
                <MailboxActivity />
              </AccountStatusCheck>
            } />
            <Route path="/workflows" element={
              <AccountStatusCheck>
                <ModuleGuard requiredModule="email_management">
                  <WorkflowManagement />
                </ModuleGuard>
              </AccountStatusCheck>
            } />
            <Route path="/workflow-rules" element={
              <AccountStatusCheck>
                <ModuleGuard requiredModule="email_management">
                  <WorkflowRules />
                </ModuleGuard>
              </AccountStatusCheck>
            } />
            <Route path="/email-categories" element={
              <AccountStatusCheck>
                <ModuleGuard requiredModule="email_management">
                  <EmailCategories />
                </ModuleGuard>
              </AccountStatusCheck>
            } />
            <Route path="/email-monitoring" element={
              <AccountStatusCheck>
                <ModuleGuard requiredModule="email_management">
                  <EmailMonitoring />
                </ModuleGuard>
              </AccountStatusCheck>
            } />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/settings" element={
              <AccountStatusCheck>
                <Settings />
              </AccountStatusCheck>
            } />
            <Route path="/ai-classification" element={
              <AccountStatusCheck>
                <ModuleGuard requiredModule="email_management">
                  <AIClassification />
                </ModuleGuard>
              </AccountStatusCheck>
            } />
            <Route path="/admin/diagnostics" element={
              <AccountStatusCheck>
                <AdminDiagnostics />
              </AccountStatusCheck>
            } />
            <Route 
              path="/admin/users" 
              element={
                <ProtectedRoute requireSuperAdmin>
                  <AccountStatusCheck>
                    <UserManagement />
                  </AccountStatusCheck>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/quarantine-test" 
              element={
                <ProtectedRoute requireAdmin>
                  <AccountStatusCheck>
                    <ModuleGuard requiredModule="security">
                      <QuarantineTest />
                    </ModuleGuard>
                  </AccountStatusCheck>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/settings" 
              element={
                <ProtectedRoute requireSuperAdmin>
                  <AccountStatusCheck>
                    <SuperAdminSettings />
                  </AccountStatusCheck>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/guide" 
              element={
                <ProtectedRoute requireSuperAdmin>
                  <AccountStatusCheck>
                    <SuperAdminGuide />
                  </AccountStatusCheck>
                </ProtectedRoute>
              } 
            />
            <Route path="/user-guide" element={
              <AccountStatusCheck>
                <UserGuide />
              </AccountStatusCheck>
            } />
            <Route path="/threat-intelligence" element={
              <AccountStatusCheck>
                <ModuleGuard requiredModule="security">
                  <ThreatIntelligence />
                </ModuleGuard>
              </AccountStatusCheck>
            } />
            <Route path="/threat-monitor" element={
              <AccountStatusCheck>
                <ModuleGuard requiredModule="security">
                  <ThreatMonitor />
                </ModuleGuard>
              </AccountStatusCheck>
            } />
            <Route path="/teams-overview" element={
              <AccountStatusCheck>
                <TeamsOverview />
              </AccountStatusCheck>
            } />
            <Route path="/teams-settings" element={
              <AccountStatusCheck>
                <TeamsSettings />
              </AccountStatusCheck>
            } />
            <Route 
              path="/teams-bot-guide" 
              element={
                <ProtectedRoute requireSuperAdmin>
                  <AccountStatusCheck>
                    <TeamsBotGuide />
                  </AccountStatusCheck>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/module-management" 
              element={
                <ProtectedRoute requireSuperAdmin>
                  <AccountStatusCheck>
                    <ModuleManagement />
                  </AccountStatusCheck>
                </ProtectedRoute>
              } 
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <PlatformAssistant />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;