import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Mail,
  AlertTriangle,
  Loader2
} from "lucide-react";

interface MeetingRequest {
  id: string;
  subject: string;
  sender_email: string;
  sender_name?: string;
  body_content?: string;
  received_at: string;
  mailbox_id: string;
}

interface AlternativeTime {
  start: string;
  end: string;
  dayOfWeek: string;
  timeDescription: string;
}

interface CalendarMeetingAssistantProps {
  email: MeetingRequest;
}

const CalendarMeetingAssistant = ({ email }: CalendarMeetingAssistantProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    available: boolean;
    alternatives?: AlternativeTime[];
    draftEmail?: string;
    message?: string;
  } | null>(null);

  const extractMeetingDetails = (emailContent: string) => {
    // Simple regex patterns to extract meeting details from email content
    const timePatterns = [
      /(\d{1,2}:\d{2}\s?(?:AM|PM|am|pm))/gi,
      /(\d{1,2}\s?(?:AM|PM|am|pm))/gi,
    ];
    
    const datePatterns = [
      /(\w+,?\s+\w+\s+\d{1,2},?\s+\d{4})/gi,
      /(\d{1,2}\/\d{1,2}\/\d{4})/gi,
      /(\d{4}-\d{2}-\d{2})/gi,
    ];

    // Extract potential times and dates
    const times = timePatterns.flatMap(pattern => 
      Array.from(emailContent.matchAll(pattern), m => m[1])
    );
    
    const dates = datePatterns.flatMap(pattern => 
      Array.from(emailContent.matchAll(pattern), m => m[1])
    );

    // For demo purposes, generate a sample meeting time
    const now = new Date();
    const proposedStart = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    proposedStart.setHours(14, 0, 0, 0); // 2 PM
    const proposedEnd = new Date(proposedStart.getTime() + 60 * 60 * 1000); // 1 hour meeting

    return {
      proposedStartTime: proposedStart.toISOString(),
      proposedEndTime: proposedEnd.toISOString(),
      extractedTimes: times,
      extractedDates: dates
    };
  };

  const checkCalendarAvailability = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const meetingDetails = extractMeetingDetails(email.body_content || email.subject);
      
      const meetingRequest = {
        meetingId: email.id,
        mailboxId: email.mailbox_id,
        subject: email.subject,
        organizer: email.sender_name || email.sender_email,
        attendees: [email.sender_email],
        proposedStartTime: meetingDetails.proposedStartTime,
        proposedEndTime: meetingDetails.proposedEndTime,
        description: email.body_content
      };

      console.log('Checking calendar for meeting:', meetingRequest);

      const { data, error } = await supabase.functions.invoke('calendar-meeting-assistant', {
        body: { meetingRequest }
      });

      if (error) {
        throw error;
      }

      setCheckResult(data);

      if (data.available) {
        toast({
          title: "Time Available",
          description: "The proposed meeting time is available in your calendar.",
        });
      } else {
        toast({
          title: "Conflict Found",
          description: `Found ${data.alternatives?.length || 0} alternative time slots.`,
        });
      }

    } catch (error) {
      console.error('Error checking calendar:', error);
      toast({
        title: "Error",
        description: "Failed to check calendar availability. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyDraftEmail = () => {
    if (checkResult?.draftEmail) {
      navigator.clipboard.writeText(checkResult.draftEmail);
      toast({
        title: "Copied",
        description: "Draft email copied to clipboard.",
      });
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Calendar Meeting Assistant
        </CardTitle>
        <CardDescription>
          Check calendar availability and suggest alternative meeting times
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Meeting Details */}
        <div className="space-y-2">
          <h4 className="font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Meeting Request
          </h4>
          <div className="text-sm text-muted-foreground">
            <p><strong>From:</strong> {email.sender_name || email.sender_email}</p>
            <p><strong>Subject:</strong> {email.subject}</p>
            <p><strong>Received:</strong> {formatDateTime(email.received_at)}</p>
          </div>
        </div>

        {/* Check Calendar Button */}
        <Button 
          onClick={checkCalendarAvailability}
          disabled={loading}
          className="w-full"
          variant="outline"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Checking Calendar...
            </>
          ) : (
            <>
              <Calendar className="h-4 w-4 mr-2" />
              Check Calendar Availability
            </>
          )}
        </Button>

        {/* Results */}
        {checkResult && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2">
              {checkResult.available ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Available
                  </Badge>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    Conflict
                  </Badge>
                </>
              )}
              <span className="text-sm text-muted-foreground">
                {checkResult.message}
              </span>
            </div>

            {/* Alternative Times */}
            {checkResult.alternatives && checkResult.alternatives.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Suggested Alternative Times
                </h4>
                <div className="space-y-2">
                  {checkResult.alternatives.map((alt, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                    >
                      <Badge variant="outline" className="text-xs">
                        {index + 1}
                      </Badge>
                      <span className="text-sm">{alt.timeDescription}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Draft Email */}
            {checkResult.draftEmail && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Draft Response
                  </h4>
                  <Button 
                    onClick={copyDraftEmail}
                    variant="outline" 
                    size="sm"
                  >
                    Copy Draft
                  </Button>
                </div>
                <div className="bg-muted/30 p-3 rounded-lg">
                  <pre className="text-xs whitespace-pre-wrap font-mono">
                    {checkResult.draftEmail}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-blue-800 mb-1">How it works:</p>
            <ul className="space-y-1 text-blue-700">
              <li>• Analyzes your calendar for the proposed meeting time</li>
              <li>• Suggests alternative times if there's a conflict</li>
              <li>• Generates a professional response email with alternatives</li>
              <li>• Considers your typical working hours (9 AM - 5 PM, weekdays)</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CalendarMeetingAssistant;