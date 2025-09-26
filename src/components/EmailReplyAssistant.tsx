import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Wand2 } from "lucide-react";

interface EmailReplyAssistantProps {
  open: boolean;
  onClose: () => void;
  email: {
    id: string;
    microsoft_id: string;
    subject: string;
    sender_email: string;
    sender_name?: string;
    body_content?: string;
    received_at: string;
    mailbox_id: string;
  };
}

type ReplyType = 'quick' | 'professional' | 'friendly' | 'detailed' | 'auto';

export function EmailReplyAssistant({ open, onClose, email }: EmailReplyAssistantProps) {
  const [replyType, setReplyType] = useState<ReplyType>('auto');
  const [generatedReply, setGeneratedReply] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [additionalContext, setAdditionalContext] = useState('');

  const generateReply = async () => {
    setIsGenerating(true);
    try {
      // Get the current session to ensure we have a valid token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in to generate replies');
      }

      const { data, error } = await supabase.functions.invoke('generate-email-reply', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          originalEmail: {
            subject: email.subject,
            senderEmail: email.sender_email,
            senderName: email.sender_name,
            bodyContent: email.body_content || '',
            receivedAt: email.received_at
          },
          replyType,
          additionalContext: additionalContext || undefined
        }
      });

      if (error) throw error;

      if (data?.success) {
        setGeneratedReply(data.generatedReply);
        toast({
          title: "Reply Generated",
          description: "AI has generated a reply based on your preferences.",
        });
      } else {
        throw new Error(data?.error || 'Failed to generate reply');
      }
    } catch (error) {
      console.error('Error generating reply:', error);
        toast({
          title: "Generation Failed",
          description: error.message || "Failed to generate reply. Please try again.",
          variant: "destructive",
        });
    } finally {
      setIsGenerating(false);
    }
  };

  const sendReply = async () => {
    if (!generatedReply.trim()) {
      toast({
        title: "No Reply Content",
        description: "Please generate or write a reply before sending.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email-reply', {
        body: {
          mailboxId: email.mailbox_id,
          originalEmail: {
            microsoftId: email.microsoft_id,
            subject: email.subject,
            senderEmail: email.sender_email
          },
          replyContent: generatedReply
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Reply Sent",
          description: `Reply sent successfully to ${email.sender_email}`,
        });
        onClose();
        // Reset state
        setGeneratedReply('');
        setAdditionalContext('');
        setReplyType('auto');
      } else {
        throw new Error(data?.error || 'Failed to send reply');
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send reply. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isGenerating && !isSending) {
      onClose();
      // Reset state when closing
      setGeneratedReply('');
      setAdditionalContext('');
      setReplyType('auto');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Reply Assistant</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Original Email Context */}
          <div className="rounded-lg border p-3 bg-muted/50">
            <div className="text-sm text-muted-foreground mb-2">Replying to:</div>
            <div className="font-medium">{email.sender_name || email.sender_email}</div>
            <div className="text-sm text-muted-foreground">{email.subject}</div>
            {email.body_content && (
              <div className="text-sm mt-2 max-h-20 overflow-y-auto text-muted-foreground">
                {email.body_content.substring(0, 200)}
                {email.body_content.length > 200 && '...'}
              </div>
            )}
          </div>

          {/* Reply Type Selector */}
          <div className="space-y-2">
            <Label>Reply Type</Label>
            <Select value={replyType} onValueChange={(value: ReplyType) => setReplyType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select reply type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Match sender's tone)</SelectItem>
                <SelectItem value="quick">Quick Response</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Additional Context */}
          <div className="space-y-2">
            <Label>Additional Context (Optional)</Label>
            <Textarea
              placeholder="Add any specific points you want to address or context for the AI..."
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              rows={2}
            />
          </div>

          {/* Generate Button */}
          <Button 
            onClick={generateReply} 
            disabled={isGenerating || isSending}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Reply...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate AI Reply
              </>
            )}
          </Button>

          {/* Generated Reply Editor */}
          {generatedReply && (
            <div className="space-y-2">
              <Label>Generated Reply</Label>
              <Textarea
                value={generatedReply}
                onChange={(e) => setGeneratedReply(e.target.value)}
                rows={8}
                placeholder="Your generated reply will appear here..."
                className="font-mono text-sm"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isGenerating || isSending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={sendReply}
              disabled={!generatedReply.trim() || isGenerating || isSending}
              className="flex-1"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Reply
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}