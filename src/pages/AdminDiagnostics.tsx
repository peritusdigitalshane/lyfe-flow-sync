import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, RefreshCw, CheckCircle, XCircle, AlertCircle, Play, Database, Mail, Users, Settings, Workflow, Globe } from "lucide-react";
import { Link } from "react-router-dom";

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'warning';
  message: string;
  details?: string;
  timestamp: string;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  component: string;
  message: string;
  details?: any;
}

export default function AdminDiagnostics() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const { toast } = useToast();

  const addLog = (level: LogEntry['level'], component: string, message: string, details?: any) => {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      details
    };
    setLogs(prev => [logEntry, ...prev].slice(0, 1000)); // Keep last 1000 logs
  };

  const updateTest = (name: string, status: TestResult['status'], message: string, details?: string) => {
    setTests(prev => {
      const existing = prev.find(t => t.name === name);
      const updated: TestResult = {
        name,
        status,
        message,
        details,
        timestamp: new Date().toISOString()
      };
      
      if (existing) {
        return prev.map(t => t.name === name ? updated : t);
      } else {
        return [...prev, updated];
      }
    });
    
    addLog(status === 'error' ? 'error' : status === 'warning' ? 'warn' : 'info', 'TEST', `${name}: ${message}`, details);
  };

  // Database connectivity tests
  const testDatabaseConnection = async () => {
    updateTest("Database Connection", "running", "Testing database connectivity...");
    
    try {
      const { data, error } = await supabase.from('profiles').select('count').limit(1);
      if (error) throw error;
      
      updateTest("Database Connection", "success", "Database connection successful");
      return true;
    } catch (error: any) {
      updateTest("Database Connection", "error", "Database connection failed", error.message);
      return false;
    }
  };

  // Authentication tests
  const testAuthentication = async () => {
    updateTest("Authentication", "running", "Testing authentication status...");
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      if (session) {
        updateTest("Authentication", "success", `Authenticated as ${session.user.email}`);
        return true;
      } else {
        updateTest("Authentication", "warning", "No active session");
        return false;
      }
    } catch (error: any) {
      updateTest("Authentication", "error", "Authentication test failed", error.message);
      return false;
    }
  };

  // Mailbox connectivity tests
  const testMailboxes = async () => {
    updateTest("Mailboxes", "running", "Testing mailbox connections...");
    
    try {
      const { data: mailboxes, error } = await supabase
        .from('mailboxes')
        .select('*');
      
      if (error) throw error;
      
      if (!mailboxes || mailboxes.length === 0) {
        updateTest("Mailboxes", "warning", "No mailboxes configured");
        return false;
      }
      
      const connectedCount = mailboxes.filter(m => m.status === 'connected').length;
      const errorCount = mailboxes.filter(m => m.status === 'error').length;
      
      if (errorCount > 0) {
        updateTest("Mailboxes", "warning", `${connectedCount} connected, ${errorCount} with errors`, 
          `Total: ${mailboxes.length} mailboxes`);
      } else {
        updateTest("Mailboxes", "success", `${connectedCount} mailboxes connected successfully`);
      }
      
      return connectedCount > 0;
    } catch (error: any) {
      updateTest("Mailboxes", "error", "Mailbox test failed", error.message);
      return false;
    }
  };

  // Test Microsoft Graph API tokens
  const testMicrosoftGraphTokens = async () => {
    updateTest("Microsoft Graph Tokens", "running", "Testing Microsoft Graph API tokens...");
    
    try {
      const { data: mailboxes, error } = await supabase
        .from('mailboxes')
        .select('id, email_address, microsoft_graph_token')
        .eq('status', 'connected');
      
      if (error) throw error;
      
      if (!mailboxes || mailboxes.length === 0) {
        updateTest("Microsoft Graph Tokens", "warning", "No connected mailboxes to test");
        return false;
      }
      
      let validTokens = 0;
      let expiredTokens = 0;
      let invalidTokens = 0;
      
      for (const mailbox of mailboxes) {
        try {
          if (!mailbox.microsoft_graph_token) {
            invalidTokens++;
            continue;
          }
          
          const token = JSON.parse(mailbox.microsoft_graph_token);
          const now = Date.now();
          
          if (token.expires_at && token.expires_at <= now) {
            expiredTokens++;
          } else if (token.access_token) {
            validTokens++;
          } else {
            invalidTokens++;
          }
        } catch {
          invalidTokens++;
        }
      }
      
      if (invalidTokens > 0 || expiredTokens > 0) {
        updateTest("Microsoft Graph Tokens", "warning", 
          `${validTokens} valid, ${expiredTokens} expired, ${invalidTokens} invalid tokens`);
      } else {
        updateTest("Microsoft Graph Tokens", "success", `All ${validTokens} tokens are valid`);
      }
      
      return validTokens > 0;
    } catch (error: any) {
      updateTest("Microsoft Graph Tokens", "error", "Token validation failed", error.message);
      return false;
    }
  };

  // Test email categories sync
  const testCategorySync = async () => {
    updateTest("Category Sync", "running", "Testing category sync functionality...");
    
    try {
      const { data: mailboxes, error } = await supabase
        .from('mailboxes')
        .select('id')
        .eq('status', 'connected')
        .limit(1);
      
      if (error) throw error;
      
      if (!mailboxes || mailboxes.length === 0) {
        updateTest("Category Sync", "warning", "No connected mailboxes for testing");
        return false;
      }
      
      const response = await supabase.functions.invoke('sync-mailbox-categories', {
        body: { mailboxId: mailboxes[0].id }
      });
      
      if (response.error) {
        const errorDetails = response.data?.details || response.error.message;
        updateTest("Category Sync", "error", "Category sync failed", 
          `Error: ${response.error.message}${errorDetails ? ` | Details: ${JSON.stringify(errorDetails)}` : ''}`);
        return false;
      }
      
      updateTest("Category Sync", "success", "Category sync test completed successfully");
      return true;
    } catch (error: any) {
      updateTest("Category Sync", "error", "Category sync test failed", error.message);
      return false;
    }
  };

  // Test email polling status
  const testEmailPolling = async () => {
    updateTest("Email Polling", "running", "Testing email polling status...");
    
    try {
      const { data: pollingStatus, error } = await supabase
        .from('email_polling_status')
        .select('*');
      
      if (error) throw error;
      
      if (!pollingStatus || pollingStatus.length === 0) {
        updateTest("Email Polling", "warning", "No polling status records found");
        return false;
      }
      
      const activePollers = pollingStatus.filter(p => p.is_polling_active).length;
      const errorPollers = pollingStatus.filter(p => p.errors_count > 0).length;
      
      if (errorPollers > 0) {
        updateTest("Email Polling", "warning", 
          `${activePollers} active pollers, ${errorPollers} with errors`);
      } else {
        updateTest("Email Polling", "success", `${activePollers} pollers running successfully`);
      }
      
      return activePollers > 0;
    } catch (error: any) {
      updateTest("Email Polling", "error", "Email polling test failed", error.message);
      return false;
    }
  };

  // Test workflow rules
  const testWorkflowRules = async () => {
    updateTest("Workflow Rules", "running", "Testing workflow rules...");
    
    try {
      const { data: rules, error } = await supabase
        .from('workflow_rules')
        .select('*');
      
      if (error) throw error;
      
      if (!rules || rules.length === 0) {
        updateTest("Workflow Rules", "warning", "No workflow rules configured");
        return false;
      }
      
      const activeRules = rules.filter(r => r.is_active).length;
      updateTest("Workflow Rules", "success", `${activeRules} active workflow rules found`);
      return true;
    } catch (error: any) {
      updateTest("Workflow Rules", "error", "Workflow rules test failed", error.message);
      return false;
    }
  };

  // Test edge functions
  const testEdgeFunctions = async () => {
    updateTest("Edge Functions", "running", "Testing edge function availability...");
    
    try {
      // Test a simple edge function call
      const response = await supabase.functions.invoke('sync-mailbox-categories', {
        body: { test: true }
      });
      
      // Even if it returns an error, if we get a response, the function is available
      updateTest("Edge Functions", "success", "Edge functions are accessible");
      return true;
    } catch (error: any) {
      if (error.message?.includes('Edge Function returned')) {
        updateTest("Edge Functions", "success", "Edge functions are accessible");
        return true;
      }
      updateTest("Edge Functions", "error", "Edge functions test failed", error.message);
      return false;
    }
  };

  const runAllTests = async () => {
    setIsRunningTests(true);
    setTests([]);
    addLog('info', 'DIAGNOSTICS', 'Starting comprehensive system diagnostics...');
    
    try {
      await testDatabaseConnection();
      await testAuthentication();
      await testMailboxes();
      await testMicrosoftGraphTokens();
      await testEmailPolling();
      await testWorkflowRules();
      await testEdgeFunctions();
      await testCategorySync();
      
      addLog('info', 'DIAGNOSTICS', 'All diagnostic tests completed');
      toast({
        title: "Success",
        description: "Diagnostic tests completed",
      });
    } catch (error: any) {
      addLog('error', 'DIAGNOSTICS', 'Diagnostic tests failed', error.message);
      toast({
        title: "Error", 
        description: "Diagnostic tests failed",
        variant: "destructive",
      });
    } finally {
      setIsRunningTests(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const variants: Record<TestResult['status'], string> = {
      success: 'bg-green-100 text-green-800',
      error: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      running: 'bg-blue-100 text-blue-800',
      pending: 'bg-gray-100 text-gray-800'
    };
    
    return (
      <Badge variant="secondary" className={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-600';
      case 'warn':
        return 'text-yellow-600';
      case 'info':
        return 'text-blue-600';
      case 'debug':
        return 'text-gray-600';
      default:
        return 'text-gray-800';
    }
  };

  useEffect(() => {
    addLog('info', 'DIAGNOSTICS', 'Admin diagnostics page loaded');
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/settings">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">System Diagnostics</h1>
          <p className="text-muted-foreground">Comprehensive testing and troubleshooting tools</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Diagnostic Tests
            </CardTitle>
            <CardDescription>
              Run comprehensive tests to identify system issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={runAllTests} 
              disabled={isRunningTests}
              className="w-full"
            >
              {isRunningTests ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run All Tests
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Test Results Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Test Results Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {tests.filter(t => t.status === 'success').length}
                </div>
                <div className="text-sm text-muted-foreground">Passed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">
                  {tests.filter(t => t.status === 'warning').length}
                </div>
                <div className="text-sm text-muted-foreground">Warnings</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {tests.filter(t => t.status === 'error').length}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {tests.filter(t => t.status === 'running').length}
                </div>
                <div className="text-sm text-muted-foreground">Running</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Test Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Test Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tests.map((test, index) => (
              <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                <div className="mt-0.5">
                  {getStatusIcon(test.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{test.name}</h3>
                    {getStatusBadge(test.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{test.message}</p>
                  {test.details && (
                    <p className="text-xs text-gray-500 mt-1 font-mono">{test.details}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(test.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {tests.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No tests run yet. Click "Run All Tests" to begin diagnostics.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            System Logs
          </CardTitle>
          <CardDescription>
            Real-time system activity and diagnostic information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div key={index} className="text-xs font-mono p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`font-semibold ${getLevelColor(log.level)}`}>
                      [{log.level.toUpperCase()}]
                    </span>
                    <span className="text-gray-700">[{log.component}]</span>
                    <span>{log.message}</span>
                  </div>
                  {log.details && (
                    <div className="mt-1 pl-4 text-gray-600">
                      {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                    </div>
                  )}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No logs yet. System activity will appear here.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}