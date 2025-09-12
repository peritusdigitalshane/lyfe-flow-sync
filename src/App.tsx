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
import UserGuide from "./pages/UserGuide";
import ThreatIntelligence from "./pages/ThreatIntelligence";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

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
                <WorkflowManagement />
              </AccountStatusCheck>
            } />
            <Route path="/workflow-rules" element={
              <AccountStatusCheck>
                <WorkflowRules />
              </AccountStatusCheck>
            } />
            <Route path="/email-categories" element={
              <AccountStatusCheck>
                <EmailCategories />
              </AccountStatusCheck>
            } />
            <Route path="/email-monitoring" element={
              <AccountStatusCheck>
                <EmailMonitoring />
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
                <AIClassification />
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
                    <QuarantineTest />
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
                <ThreatIntelligence />
              </AccountStatusCheck>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;