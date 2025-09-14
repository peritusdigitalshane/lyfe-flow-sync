import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, PlayCircle, CheckCircle, AlertCircle, Play } from "lucide-react";
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

const TriggerEmailProcessing: React.FC<{ mailboxId?: string }> = ({ mailboxId }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClearingQueue, setIsClearingQueue] = useState(false);
  const [results, setResults] = useState<ProcessingResponse | null>(null);
  const [emailId, setEmailId] = useState('');
  const [specificMailboxId, setSpecificMailboxId] = useState('');

  const clearProcessingQueue = async () => {
    setIsClearingQueue(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('clear-email-queue', {
        body: {}
      });

      if (error) {
        throw error;
      }

      setResults({
        processedCount: data.processed || 0,
        results: data.results || []
      });
      toast.success(`🚀 Cleared processing queue! Processed ${data.processed || 0} stuck emails`);
    } catch (error) {
      console.error('Error clearing email queue:', error);
      toast.error('Failed to clear processing queue');
    } finally {
      setIsClearingQueue(false);
    }
  };

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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5" />
          Manual Email Processing
        </CardTitle>
        <CardDescription>
          Trigger workflow processing for unprocessed emails. This will run AI categorization and spam detection.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="clear" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="clear" className="text-red-600 font-semibold">🚨 Clear Queue</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Processing</TabsTrigger>
            <TabsTrigger value="specific">Specific Email</TabsTrigger>
          </TabsList>
          
          <TabsContent value="clear" className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-md p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-red-900">Emergency Queue Clearance</h4>
                  <p className="text-sm text-red-700 mt-1">
                    This will force-process ALL stuck emails in the pending queue. Use this to fix the processing backlog.
                  </p>
                </div>
              </div>
              <Button 
                onClick={clearProcessingQueue} 
                disabled={isClearingQueue || isProcessing}
                className="w-full bg-red-600 hover:bg-red-700"
                size="lg"
              >
                {isClearingQueue && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isClearingQueue ? 'Clearing Queue...' : '🚨 Clear Processing Queue (Force Process All)'}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="bulk" className="space-y-4">
            <Button 
              onClick={triggerBulkProcessing} 
              disabled={isProcessing}
              className="w-full"
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

            {results.results.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Processing Results:</h4>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {results.results.map((result) => (
                    <div 
                      key={result.emailId}
                      className={`p-3 rounded-md border text-sm ${
                        result.success 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-red-200 bg-red-50'
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
  );
};

export default TriggerEmailProcessing;