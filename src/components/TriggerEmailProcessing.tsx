import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, PlayCircle, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [results, setResults] = useState<ProcessingResponse | null>(null);

  const triggerProcessing = async () => {
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
        <Button 
          onClick={triggerProcessing} 
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isProcessing ? 'Processing Emails...' : 'Process Unprocessed Emails'}
        </Button>

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