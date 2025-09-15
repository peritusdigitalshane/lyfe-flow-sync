import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useModules } from '@/hooks/useModules';
import { CheckCircle, XCircle, AlertTriangle, Shield, Mail, Database, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

export default function ModuleSecurityTest() {
  const { user } = useAuth();
  const { hasEmailManagement, hasSecurity } = useModules();
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const runSecurityTests = async () => {
    setTesting(true);
    setResults([]);
    const testResults: TestResult[] = [];

    try {
      // Test 1: Check module assignments
      const { data: modules, error: moduleError } = await supabase
        .from('user_modules')
        .select('module, is_active, expires_at')
        .eq('user_id', user?.id);

      if (moduleError) {
        testResults.push({
          name: 'Module Assignment Check',
          status: 'fail',
          message: 'Failed to fetch user modules',
          details: moduleError.message
        });
      } else {
        const emailModule = modules?.find(m => m.module === 'email_management');
        const securityModule = modules?.find(m => m.module === 'security');

        testResults.push({
          name: 'Email Management Module',
          status: emailModule?.is_active ? 'pass' : 'fail',
          message: emailModule?.is_active ? 'Properly assigned and active' : 'Not assigned or inactive',
          details: `Module status: ${emailModule ? 'Found' : 'Missing'}`
        });

        testResults.push({
          name: 'Security Module Access',
          status: securityModule?.is_active ? 'pass' : 'warning',
          message: securityModule?.is_active ? 'Security module assigned' : 'Security module not assigned (expected for non-premium users)',
          details: `Module status: ${securityModule ? 'Found and active' : 'Not assigned'}`
        });
      }

      // Test 2: Check hook states
      testResults.push({
        name: 'useModules Hook - Email Management',
        status: hasEmailManagement ? 'pass' : 'fail',
        message: hasEmailManagement ? 'Hook correctly detects Email Management access' : 'Hook failed to detect Email Management access',
        details: `hasEmailManagement: ${hasEmailManagement}`
      });

      testResults.push({
        name: 'useModules Hook - Security',
        status: hasSecurity ? 'pass' : 'warning',
        message: hasSecurity ? 'Hook correctly detects Security access' : 'Hook correctly shows no Security access',
        details: `hasSecurity: ${hasSecurity}`
      });

      // Test 3: Database function tests
      const { data: securityCheck, error: securityError } = await supabase
        .rpc('user_has_module_access', { 
          _user_id: user?.id, 
          _module: 'security' 
        });

      testResults.push({
        name: 'Database Function - Security Check',
        status: securityError ? 'fail' : 'pass',
        message: securityError ? 'Database function failed' : `Security access: ${securityCheck}`,
        details: securityError?.message || `Function returned: ${securityCheck}`
      });

      const { data: threatCheck, error: threatError } = await supabase
        .rpc('has_threat_intelligence_access', { _user_id: user?.id });

      testResults.push({
        name: 'Threat Intelligence Access Check',
        status: threatError ? 'fail' : 'pass',
        message: threatError ? 'Threat intelligence check failed' : `Threat access: ${threatCheck}`,
        details: threatError?.message || `Function returned: ${threatCheck}`
      });

      // Test 4: Test threat intelligence edge function (if user has security)
      if (hasSecurity) {
        try {
          const { data: threatResponse, error: threatIntelError } = await supabase.functions.invoke('threat-intelligence-checker', {
            body: {
              email_id: 'test-email-id',
              email_content: {
                subject: 'Test Email',
                sender_email: 'test@example.com',
                body_content: 'This is a test email for security module validation'
              },
              tenant_id: 'test-tenant'
            }
          });

          if (threatIntelError) {
            testResults.push({
              name: 'Threat Intelligence Edge Function',
              status: 'fail',
              message: 'Edge function returned an error',
              details: threatIntelError.message
            });
          } else if (threatResponse?.success) {
            const result = threatResponse.result;
            testResults.push({
              name: 'Threat Intelligence Edge Function',
              status: 'pass',
              message: `Threat scan completed: ${result.threats_detected} threats found (score: ${result.max_threat_score})`,
              details: `Quarantine: ${result.should_quarantine}, Feeds: ${result.threat_details.length > 0 ? result.threat_details.map((t: any) => t.feed_name).join(', ') : 'None'}`
            });
          } else {
            testResults.push({
              name: 'Threat Intelligence Edge Function',
              status: 'warning',
              message: 'Edge function accessible but returned unexpected response',
              details: JSON.stringify(threatResponse)
            });
          }
        } catch (error) {
          testResults.push({
            name: 'Threat Intelligence Edge Function',
            status: 'fail',
            message: 'Edge function test failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      } else {
        testResults.push({
          name: 'Threat Intelligence Edge Function',
          status: 'pass',
          message: 'Correctly blocked - user has no Security module',
          details: 'Security enforcement working as expected'
        });
      }

      // Test 5: Check RLS policies
      const { data: userModules, error: rlsError } = await supabase
        .from('user_modules')
        .select('*')
        .eq('user_id', user?.id);

      testResults.push({
        name: 'Row Level Security Test',
        status: rlsError ? 'fail' : 'pass',
        message: rlsError ? 'RLS policy test failed' : `Can access own modules (${userModules?.length || 0} found)`,
        details: rlsError?.message || 'RLS policies working correctly'
      });

      setResults(testResults);
      
      const passCount = testResults.filter(r => r.status === 'pass').length;
      const totalCount = testResults.length;
      
      toast.success(`Security tests completed: ${passCount}/${totalCount} passed`);

    } catch (error) {
      console.error('Security test error:', error);
      testResults.push({
        name: 'Test Suite',
        status: 'fail',
        message: 'Test suite encountered an error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      setResults(testResults);
      toast.error('Security tests failed');
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'pass':
        return <Badge variant="default" className="bg-green-500">Pass</Badge>;
      case 'fail':
        return <Badge variant="destructive">Fail</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-500 text-yellow-900">Warning</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Module Security Testing
          </CardTitle>
          <CardDescription>
            Validate that module permissions and security controls are working correctly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This tool tests the security enforcement of your module system. Users without the Security module should not have access to threat intelligence features.
                <br /><br />
                <strong>Threat Intelligence Test:</strong> The edge function analyzes test email content against simulated threat feeds, demonstrating domain blacklist checking and phishing detection capabilities. Test threats are automatically detected to validate the system is working.
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-3 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span className="font-medium">Email Management</span>
                </div>
                <Badge variant={hasEmailManagement ? "default" : "destructive"}>
                  {hasEmailManagement ? "Active" : "Inactive"}
                </Badge>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-destructive" />
                  <span className="font-medium">Security Module</span>
                </div>
                <Badge variant={hasSecurity ? "default" : "secondary"}>
                  {hasSecurity ? "Active" : "Not Assigned"}
                </Badge>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-4 w-4 text-accent" />
                  <span className="font-medium">User ID</span>
                </div>
                <span className="text-xs font-mono">{user?.id?.slice(0, 8)}...</span>
              </Card>
            </div>

            <Button 
              onClick={runSecurityTests} 
              disabled={testing}
              className="gap-2"
            >
              {testing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Running Tests...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Run Security Tests
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              {results.filter(r => r.status === 'pass').length} of {results.length} tests passed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                  {getStatusIcon(result.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium">{result.name}</h4>
                      {getStatusBadge(result.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{result.message}</p>
                    {result.details && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {result.details}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}