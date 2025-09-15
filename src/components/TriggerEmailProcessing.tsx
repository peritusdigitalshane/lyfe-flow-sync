import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, PlayCircle, CheckCircle, AlertCircle, Play, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProcessingResult {
  emailId: string;
  subject: string;
  success: boolean;
  error?: string;
}

interface ProcessingResponse {
  processedCount: number;
  results: ProcessingResult[];
}

interface ReprocessResults {
  success: boolean;
  message: string;
  totalEmails?: number;
  processed?: number;
  errors?: number;
  results?: any[];
}

const TriggerEmailProcessing: React.FC<{ mailboxId?: string }> = ({ mailboxId }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [results, setResults] = useState<ProcessingResponse | null>(null);
  const [reprocessResults, setReprocessResults] = useState<ReprocessResults | null>(null);
  const [emailId, setEmailId] = useState('');
  const [specificMailboxId, setSpecificMailboxId] = useState('');

  const triggerBulkProcessing = async () => {
    setIsProcessing(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('process-email-backlog', {
        body: {}
      });

      if (error) {
        throw error;
      }

      setResults(data);
      toast.success(`Processed ${data.processedCount || 0} emails`);
    } catch (error) {
      console.error('Error triggering email processing:', error);
      toast.error('Failed to trigger email processing');
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerSpecificProcessing = async () => {
    if (!emailId && !specificMailboxId) {
      toast.error("Please provide either an Email ID or Mailbox ID");
      return;
    }

    setIsProcessing(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('trigger-email-processing', {
        body: {
          emailId: emailId || undefined,
          mailboxId: specificMailboxId || mailboxId || undefined
        }
      });

      if (error) {
        console.error('Processing error:', error);
        toast.error(`Failed to trigger processing: ${error.message}`);
        return;
      }

      console.log('Processing result:', data);
      toast.success(`Successfully processed ${data.processedCount} emails`);
      
      // Convert the response to match our expected format
      setResults({
        processedCount: data.processedCount,
        results: data.results || []
      });
      
      // Clear inputs on success
      setEmailId('');
      setSpecificMailboxId('');
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('Unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReprocessEmails = async () => {
    setIsReprocessing(true);
    setReprocessResults(null);
    
    try {
      console.log('Starting reprocess emails request...');
      
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session check:', session ? 'Session exists' : 'No session');
      
      if (!session) {
        toast.error('You must be logged in to reprocess emails');
        setReprocessResults({
          success: false,
          message: "Authentication required"
        });
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('reprocess-emails');
      
      if (error) {
        console.error('Supabase function error:', error);
        toast.error(`Failed to reprocess emails: ${error.message}`);
        setReprocessResults({
          success: false,
          message: error.message || "Failed to reprocess emails"
        });
        return;
      }

      console.log('Reprocess response:', data);
      if (data && data.success) {
        toast.success(data.message + " - Check the audit logs for progress");
        setReprocessResults({
          ...data,
          message: data.message + " - Processing will continue in the background. Check the audit logs below for real-time progress."
        });
      } else {
        toast.error(data?.error || "Failed to reprocess emails");
        setReprocessResults(data || { success: false, message: "Unknown error" });
      }
    } catch (error) {
      console.error('Error reprocessing emails:', error);
      toast.error(`Error reprocessing emails: ${error.message || error}`);
      setReprocessResults({
        success: false,
        message: `Error reprocessing emails: ${error.message || error}`
      });
    } finally {
      setIsReprocessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Email Processing Control
          </CardTitle>
          <CardDescription>
            Manually trigger email processing and reprocess historical emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={triggerBulkProcessing} 
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Processing New Emails...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Process New Emails
              </>
            )}
          </Button>
          
          <Button 
            onClick={handleReprocessEmails} 
            disabled={isReprocessing}
            variant="secondary"
            className="w-full"
          >
            {isReprocessing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Reprocessing Last 50 Emails...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reprocess Last 50 Emails
              </>
            )}
          </Button>
          
          <div className="text-sm text-muted-foreground">
            <p>• <strong>Process New Emails:</strong> Fetch and process new emails from connected mailboxes</p>
            <p>• <strong>Reprocess Last 50:</strong> Reapply current rules and workflows to the last 50 emails (useful after updating rules)</p>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-5 w-5" />
            Advanced Processing Options
          </CardTitle>
          <CardDescription>
            Process specific emails or mailboxes for troubleshooting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="bulk" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bulk">Bulk Processing</TabsTrigger>
              <TabsTrigger value="specific">Specific Email</TabsTrigger>
            </TabsList>
            
            <TabsContent value="bulk" className="space-y-4">
              <Button 
                onClick={triggerBulkProcessing} 
                disabled={isProcessing}
                className="w-full"
                variant="outline"
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessing ? 'Processing Emails...' : 'Process All Unprocessed Emails'}
              </Button>
            </TabsContent>
            
            <TabsContent value="specific" className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email-id">Email ID (specific email)</Label>
                  <Input
                    id="email-id"
                    placeholder="db8696d3-9546-4088-8699-3b921bb4ee75"
                    value={emailId}
                    onChange={(e) => setEmailId(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mailbox-id">Mailbox ID (all unprocessed in mailbox)</Label>
                  <Input
                    id="mailbox-id"
                    placeholder={mailboxId || "fad85764-4880-42da-bb18-6ac5f17f27e5"}
                    value={specificMailboxId}
                    onChange={(e) => setSpecificMailboxId(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
              </div>
              
              <Button 
                onClick={triggerSpecificProcessing}
                disabled={isProcessing || (!emailId && !specificMailboxId && !mailboxId)}
                className="w-full"
                variant="outline"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Process Specific Email(s)
                  </>
                )}
              </Button>
              
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Email ID:</strong> Process a specific email that's stuck</p>
                <p><strong>Mailbox ID:</strong> Process all unprocessed emails in a mailbox</p>
              </div>
            </TabsContent>
          </Tabs>

          {results && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Processed {results.processedCount} emails successfully
                </AlertDescription>
              </Alert>

              {results.results && results.results.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Processing Results:</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {results.results.map((result) => (
                      <div 
                        key={result.emailId}
                        className={`p-3 rounded-md border text-sm ${
                          result.success 
                            ? 'border-green-200 bg-green-50 dark:bg-green-950' 
                            : 'border-red-200 bg-red-50 dark:bg-red-950'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {result.success ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{result.subject}</div>
                            <div className="text-xs text-muted-foreground font-mono truncate">
                              {result.emailId}
                            </div>
                            {result.error && (
                              <div className="text-xs text-red-600 mt-1">{result.error}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {reprocessResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {reprocessResults.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Email Reprocessing Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className={reprocessResults.success ? "border-green-200" : "border-red-200"}>
              <AlertDescription className="font-medium">
                {reprocessResults.message}
              </AlertDescription>
            </Alert>

            {reprocessResults.success && reprocessResults.totalEmails && (
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded bg-blue-50 dark:bg-blue-950">
                  <div className="text-2xl font-bold text-blue-600">{reprocessResults.totalEmails}</div>
                  <div className="text-sm text-blue-600">Total Emails</div>
                </div>
                <div className="p-3 rounded bg-green-50 dark:bg-green-950">
                  <div className="text-2xl font-bold text-green-600">{reprocessResults.processed || 0}</div>
                  <div className="text-sm text-green-600">Processed</div>
                </div>
                <div className="p-3 rounded bg-red-50 dark:bg-red-950">
                  <div className="text-2xl font-bold text-red-600">{reprocessResults.errors || 0}</div>
                  <div className="text-sm text-red-600">Errors</div>
                </div>
              </div>
            )}

            {reprocessResults.results && reprocessResults.results.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">Detailed Results:</h4>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {reprocessResults.results.map((result, index) => (
                    <div 
                      key={index} 
                      className={`text-sm p-3 rounded border ${
                        result.status === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-950' : 
                        'bg-red-50 border-red-200 dark:bg-red-950'
                      }`}
                    >
                      <div className="font-medium">
                        Email ID: {result.emailId}
                      </div>
                      <div className={`text-sm ${
                        result.status === 'success' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        Status: {result.status}
                        {result.error && ` - ${result.error}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TriggerEmailProcessing;