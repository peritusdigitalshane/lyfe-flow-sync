import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/add-mailbox" element={<AddMailbox />} />
            <Route path="/mailbox/:mailboxId/settings" element={<MailboxSettings />} />
            <Route path="/mailbox/:mailboxId/activity" element={<MailboxActivity />} />
            <Route path="/workflows" element={<WorkflowManagement />} />
            <Route path="/workflow-rules" element={<WorkflowRules />} />
            <Route path="/email-categories" element={<EmailCategories />} />
            <Route path="/email-monitoring" element={<EmailMonitoring />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/ai-classification" element={<AIClassification />} />
            <Route path="/admin/diagnostics" element={<AdminDiagnostics />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;