import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import CalendarMeetingAssistant from "@/components/CalendarMeetingAssistant";
import { ImprovedNavigation } from "@/components/ImprovedNavigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { 
  Calendar, 
  Mail, 
  Clock, 
  Settings,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from "lucide-react";

interface Email {
  id: string;
  subject: string;
  sender_email: string;
  sender_name?: string;
  body_content?: string;
  body_preview?: string;
  received_at: string;
  mailbox_id: string;
  importance: string;
}

const CalendarIntegration = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  useEffect(() => {
    if (user) {
      fetchRecentEmails();
    }
  }, [user]);

  const fetchRecentEmails = async () => {
    try {
      setLoading(true);
      
      // Get user's tenant
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (!profile) return;

      // Fetch recent emails that might be meeting requests
      const { data: emailData, error } = await supabase
        .from('emails')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('received_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Filter emails that might be meeting requests
      const meetingEmails = emailData?.filter(email => {
        const subject = email.subject.toLowerCase();
        const content = (email.body_content || email.body_preview || '').toLowerCase();
        
        return subject.includes('meeting') || 
               subject.includes('invite') ||
               subject.includes('appointment') ||
               subject.includes('schedule') ||
               content.includes('meeting') ||
               content.includes('calendar') ||
               content.includes('appointment');
      }) || [];

      setEmails(meetingEmails);

    } catch (error) {
      console.error('Error fetching emails:', error);
      toast({
        title: "Error",
        description: "Failed to load emails",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const breadcrumbItems = [
    { label: "Dashboard", href: "/" },
    { label: "Calendar Integration", href: "/calendar-integration" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <ImprovedNavigation />
      <div className="container mx-auto p-6 space-y-6">
        <Breadcrumbs />
        
        <div className="space-y-6">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Calendar className="h-8 w-8" />
              Calendar Integration
            </h1>
            <p className="text-muted-foreground">
              Automatically check calendar availability and suggest alternative meeting times
            </p>
          </div>

          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Integration Status
              </CardTitle>
              <CardDescription>
                Calendar integration status and configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Microsoft Graph Connected
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Calendar access enabled through your email integration
                </span>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-800 mb-1">How it works:</p>
                    <ul className="text-blue-700 space-y-1">
                      <li>• Detects meeting invitations in your emails</li>
                      <li>• Checks your calendar for conflicts automatically</li>
                      <li>• Suggests 3-5 alternative time slots if needed</li>
                      <li>• Generates professional response emails with alternatives</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Recent Meeting Requests
                  </CardTitle>
                  <CardDescription>
                    Emails that appear to be meeting invitations or scheduling requests
                  </CardDescription>
                </div>
                <Button 
                  onClick={fetchRecentEmails}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <div className="w-10 h-10 bg-muted rounded-full" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-3/4" />
                          <div className="h-3 bg-muted rounded w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : emails.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-lg font-medium">No meeting requests found</p>
                  <p className="text-sm text-muted-foreground">
                    Recent emails that look like meeting invitations will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emails.map((email) => (
                    <div 
                      key={email.id} 
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedEmail?.id === email.id ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedEmail(email)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-sm">
                              {email.sender_name || email.sender_email}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {email.importance}
                            </Badge>
                          </div>
                          
                          <h3 className="font-medium leading-tight mb-2">
                            {email.subject}
                          </h3>
                          
                          {email.body_preview && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {email.body_preview}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(email.received_at).toLocaleString()}
                          </div>
                        </div>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEmail(email);
                          }}
                        >
                          Check Calendar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calendar Assistant */}
          {selectedEmail && (
            <CalendarMeetingAssistant email={selectedEmail} />
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarIntegration;