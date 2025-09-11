import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Shield, TestTube, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function QuarantineTest() {
  const { user } = useAuth();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [testEmail, setTestEmail] = useState({
    subject: 'URGENT: Your account will be suspended',
    sender_email: 'noreply@suspicious-bank.com',
    sender_name: 'Security Team',
    body_content: `Dear Customer,

Your account has been flagged for suspicious activity and will be suspended within 24 hours.

To prevent suspension, please click here immediately to verify your identity:
http://verify-account-now.malicious-site.com

You must confirm your banking details and password to avoid account closure.

This is urgent - act now!

Banking Security Team`
  });

  const runQuarantineTest = async () => {
    setTesting(true);
    setResult(null);

    try {
      // Create a test email record
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user!.id)
        .single();

      if (!profile) {
        throw new Error('Profile not found');
      }

      // Get a connected mailbox for testing
      const { data: mailboxes } = await supabase
        .from('mailboxes')
        .select('id')
        .eq('status', 'connected')
        .limit(1);

      if (!mailboxes || mailboxes.length === 0) {
        throw new Error('No connected mailboxes found for testing');
      }

      const testEmailRecord = {
        tenant_id: profile.tenant_id,
        mailbox_id: mailboxes[0].id,
        microsoft_id: `test-${Date.now()}`,
        subject: testEmail.subject,
        sender_email: testEmail.sender_email,
        sender_name: testEmail.sender_name,
        body_content: testEmail.body_content,
        body_preview: testEmail.body_content.substring(0, 150),
        received_at: new Date().toISOString(),
        processing_status: 'pending',
        has_attachments: false,
        is_read: false,
        importance: 'normal'
      };

      // Insert the test email
      const { data: insertedEmail, error: insertError } = await supabase
        .from('emails')
        .insert(testEmailRecord)
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      console.log('Test email created:', insertedEmail.id);

      // Process the email through the workflow processor
      const { data: processingResult, error: processingError } = await supabase.functions.invoke(
        'email-workflow-processor',
        {
          body: {
            emailId: insertedEmail.id,
            forceProcess: true
          }
        }
      );

      if (processingError) {
        throw processingError;
      }

      console.log('Processing result:', processingResult);

      // Check the final status of the email
      const { data: finalEmail } = await supabase
        .from('emails')
        .select('processing_status')
        .eq('id', insertedEmail.id)
        .single();

      setResult({
        ...processingResult,
        finalStatus: finalEmail?.processing_status,
        emailId: insertedEmail.id
      });

      if (finalEmail?.processing_status === 'quarantined') {
        toast.success('✅ Email was successfully quarantined!');
      } else {
        toast.info('ℹ️ Email was processed but not quarantined');
      }

    } catch (error) {
      console.error('Quarantine test error:', error);
      toast.error(`Test failed: ${error.message}`);
      setResult({ error: error.message });
    } finally {
      setTesting(false);
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/settings">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Quarantine System Test
        </h1>
        <p className="text-muted-foreground">
          Test the AI-powered quarantine system with sample suspicious emails
        </p>
      </div>

      <div className="grid gap-6">
        {/* Test Email Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Test Email Configuration</CardTitle>
            <CardDescription>
              Configure a test email to see how the quarantine system responds
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={testEmail.subject}
                onChange={(e) => setTestEmail({ ...testEmail, subject: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sender-email">Sender Email</Label>
                <Input
                  id="sender-email"
                  value={testEmail.sender_email}
                  onChange={(e) => setTestEmail({ ...testEmail, sender_email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sender-name">Sender Name</Label>
                <Input
                  id="sender-name"
                  value={testEmail.sender_name}
                  onChange={(e) => setTestEmail({ ...testEmail, sender_name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Email Body</Label>
              <Textarea
                id="body"
                value={testEmail.body_content}
                onChange={(e) => setTestEmail({ ...testEmail, body_content: e.target.value })}
                className="min-h-[200px]"
              />
            </div>

            <Button 
              onClick={runQuarantineTest} 
              disabled={testing} 
              className="gap-2"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4" />
              )}
              {testing ? 'Testing...' : 'Run Quarantine Test'}
            </Button>
          </CardContent>
        </Card>

        {/* Test Results */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>
                Results from the quarantine system analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.error ? (
                <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                  <p className="text-red-800 font-medium">Test Failed</p>
                  <p className="text-red-600 text-sm">{result.error}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Final Status */}
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Final Status:</span>
                    <Badge 
                      variant={result.finalStatus === 'quarantined' ? 'destructive' : 'default'}
                    >
                      {result.finalStatus === 'quarantined' ? '🚫 Quarantined' : '✅ Allowed'}
                    </Badge>
                  </div>

                  {/* AI Analysis */}
                  {result.analysis && (
                    <div className="space-y-2">
                      <h4 className="font-medium">AI Analysis</h4>
                      <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                        <div className="flex justify-between">
                          <span>Risk Score:</span>
                          <span className={`font-bold ${getRiskColor(result.analysis.risk_score)}`}>
                            {result.analysis.risk_score}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Category:</span>
                          <span className="font-medium">{result.analysis.category}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Confidence:</span>
                          <span>{Math.round(result.analysis.confidence * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions Executed */}
                  {result.actions_executed && result.actions_executed.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Actions Executed</h4>
                      <div className="space-y-1">
                        {result.actions_executed.map((action: any, index: number) => (
                          <Badge key={index} variant="outline">
                            {action.type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Execution Time */}
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Processing Time:</span>
                    <span>{result.execution_time_ms}ms</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Test Presets */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Test Presets</CardTitle>
            <CardDescription>
              Load predefined suspicious email examples
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => setTestEmail({
                  subject: 'Re: Invoice Payment Required - URGENT',
                  sender_email: 'accounting@fake-company-inc.com',
                  sender_name: 'Finance Department',
                  body_content: 'Please click here to update your payment details immediately. Your account will be suspended if payment is not received within 24 hours. Download attachment to view invoice.'
                })}
              >
                Phishing Attempt
              </Button>
              <Button
                variant="outline"
                onClick={() => setTestEmail({
                  subject: 'Congratulations! You have won $1,000,000',
                  sender_email: 'lottery@winner-notification.biz',
                  sender_name: 'Lottery Commission',
                  body_content: 'You have been selected as the winner of our international lottery. To claim your prize of $1,000,000, please provide your banking details and personal information.'
                })}
              >
                Lottery Scam
              </Button>
              <Button
                variant="outline"
                onClick={() => setTestEmail({
                  subject: 'Meeting Tomorrow - Project Update',
                  sender_email: 'colleague@company.com',
                  sender_name: 'John Smith',
                  body_content: 'Hi, just wanted to confirm our meeting tomorrow at 2 PM to discuss the project updates. Let me know if you need to reschedule.'
                })}
              >
                Legitimate Email
              </Button>
              <Button
                variant="outline"
                onClick={() => setTestEmail({
                  subject: 'IRS TAX REFUND - Claim Now',
                  sender_email: 'refund@irs-gov-official.net',
                  sender_name: 'Internal Revenue Service',
                  body_content: 'You are eligible for a tax refund of $2,847. Click here to claim your refund immediately. Provide your social security number and banking details to process the refund.'
                })}
              >
                Government Impersonation
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}