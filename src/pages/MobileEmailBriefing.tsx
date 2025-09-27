import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { EmailReplyAssistant } from "@/components/EmailReplyAssistant";
import { supabase } from "@/integrations/supabase/client";
import { 
  Mail, 
  Star, 
  Clock, 
  AlertTriangle, 
  ArrowUp, 
  MessageSquare, 
  TrendingUp,
  Smartphone,
  Zap,
  CheckCircle2
} from "lucide-react";
import { formatDistanceToNow, startOfDay, startOfWeek } from "date-fns";

interface EmailSummary {
  total: number;
  unread: number;
  vip: number;
  urgent: number;
  todayCount: number;
  thisWeekCount: number;
}

interface ImportantEmail {
  id: string;
  subject: string;
  sender_email: string;
  sender_name?: string;
  received_at: string;
  is_vip: boolean;
  importance: string;
  body_preview?: string;
  microsoft_id: string;
}

const MobileEmailBriefing = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [emailSummary, setEmailSummary] = useState<EmailSummary>({
    total: 0,
    unread: 0,
    vip: 0,
    urgent: 0,
    todayCount: 0,
    thisWeekCount: 0
  });
  const [importantEmails, setImportantEmails] = useState<ImportantEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmailForReply, setSelectedEmailForReply] = useState<ImportantEmail | null>(null);
  const [showReplyAssistant, setShowReplyAssistant] = useState(false);
  const [emailWithMailbox, setEmailWithMailbox] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchEmailBriefing();
    }
  }, [user]);

  const fetchEmailBriefing = async () => {
    try {
      setLoading(true);
      console.log('Fetching email briefing for user:', user?.id);
      
      // Get user's tenant
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (!profile) {
        console.log('No profile found');
        return;
      }

      console.log('User tenant_id:', profile.tenant_id);

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const todayStart = startOfDay(now);
      const weekStart = startOfWeek(now);

      console.log('Date filters:', {
        now: now.toISOString(),
        yesterday: yesterday.toISOString(),
        todayStart: todayStart.toISOString(),
        weekStart: weekStart.toISOString()
      });

      // Fetch email counts efficiently with separate queries
      const [emailCountsResult, recentEmailsResult] = await Promise.all([
        // Get total counts
        supabase
          .from('emails')
          .select('id, is_read, is_vip, importance, received_at', { count: 'exact' })
          .eq('tenant_id', profile.tenant_id),
        
        // Get recent important emails only (last 50 for processing)
        supabase
          .from('emails')
          .select('id, subject, sender_email, sender_name, received_at, is_vip, importance, body_preview, microsoft_id, is_read')
          .eq('tenant_id', profile.tenant_id)
          .order('received_at', { ascending: false })
          .limit(50)
      ]);

      const { data: emailCounts, error: emailCountsError } = emailCountsResult;
      const { data: recentEmails, error: recentEmailsError } = recentEmailsResult;

      if (emailCountsError || recentEmailsError) {
        console.error('Error fetching emails:', emailCountsError || recentEmailsError);
        throw emailCountsError || recentEmailsError;
      }

      console.log('Fetched email counts:', emailCounts?.length || 0);
      console.log('Fetched recent emails:', recentEmails?.length || 0);
      
      if (recentEmails && recentEmails.length > 0) {
        console.log('Sample recent email dates:', recentEmails.slice(0, 3).map(e => ({
          subject: e.subject,
          received_at: e.received_at,
          is_read: e.is_read,
          is_vip: e.is_vip,
          importance: e.importance
        })));
      }

      // Calculate summary stats efficiently
      const total = emailCounts?.length || 0;
      const unread = emailCounts?.filter(e => !e.is_read).length || 0;
      const vip = emailCounts?.filter(e => e.is_vip).length || 0;
      const urgent = emailCounts?.filter(e => e.importance === 'high').length || 0;
      
      // Filter for last 24 hours instead of just today (using counts data)
      const last24Hours = emailCounts?.filter(e => new Date(e.received_at) >= yesterday).length || 0;
      const thisWeekCount = emailCounts?.filter(e => new Date(e.received_at) >= weekStart).length || 0;

      console.log('Calculated stats:', {
        total,
        unread,
        vip,
        urgent,
        last24Hours,
        thisWeekCount
      });

      setEmailSummary({
        total,
        unread,
        vip,
        urgent,
        todayCount: last24Hours, // Show last 24 hours instead of just today
        thisWeekCount
      });

      // Get important emails from recent emails (VIP, high importance, or recent and unread within last 24 hours)
      const important = recentEmails?.filter(email => {
        const emailDate = new Date(email.received_at);
        const isRecent = emailDate >= yesterday;
        
        return email.is_vip || 
               email.importance === 'high' || 
               (!email.is_read && isRecent);
      }).slice(0, 10) || [];

      console.log('Important emails found:', important.length);

      setImportantEmails(important);

    } catch (error) {
      console.error('Error fetching email briefing:', error);
      toast({
        title: "Error",
        description: "Failed to load email briefing",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickReply = async (email: ImportantEmail) => {
    try {
      // Fetch the email with mailbox_id
      const { data: emailData, error } = await supabase
        .from('emails')
        .select('*, mailbox_id')
        .eq('id', email.id)
        .single();

      if (error) {
        console.error('Error fetching email with mailbox:', error);
        toast({
          title: "Error",
          description: "Failed to load email details for reply",
          variant: "destructive",
        });
        return;
      }

      setEmailWithMailbox({
        id: email.id,
        subject: email.subject,
        sender_email: email.sender_email,
        sender_name: email.sender_name,
        body_content: email.body_preview,
        microsoft_id: email.microsoft_id,
        received_at: email.received_at,
        mailbox_id: emailData.mailbox_id,
      });
      setSelectedEmailForReply(email);
      setShowReplyAssistant(true);
    } catch (error) {
      console.error('Error preparing reply:', error);
      toast({
        title: "Error",
        description: "Failed to prepare reply",
        variant: "destructive",
      });
    }
  };

  const closeReplyAssistant = () => {
    setShowReplyAssistant(false);
    setSelectedEmailForReply(null);
    setEmailWithMailbox(null);
  };

  const getEmailInitials = (email: string) => {
    return email.split('@')[0].slice(0, 2).toUpperCase();
  };

  const getImportanceColor = (email: ImportantEmail) => {
    if (email.is_vip) return "text-yellow-600";
    if (email.importance === 'high') return "text-red-600";
    return "text-blue-600";
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground">Please log in to view your email briefing.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Email Briefing</h1>
            </div>
            <Badge variant="outline" className="ml-auto">
              <Clock className="h-3 w-3 mr-1" />
              {formatDistanceToNow(new Date(), { addSuffix: true })}
            </Badge>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{emailSummary.total}</p>
                <p className="text-sm text-muted-foreground">Total Emails</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <ArrowUp className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{emailSummary.unread}</p>
                <p className="text-sm text-muted-foreground">Unread</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{emailSummary.vip}</p>
                <p className="text-sm text-muted-foreground">VIP Emails</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{emailSummary.todayCount}</p>
                <p className="text-sm text-muted-foreground">Last 24h</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={fetchEmailBriefing}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Refresh Briefing
            </Button>
          </CardContent>
        </Card>

        {/* Important Emails */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Important Emails
            </CardTitle>
            <CardDescription>
              VIP emails, high priority, and recent unread messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="w-10 h-10 bg-muted rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : importantEmails.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm text-muted-foreground">No urgent emails need your attention right now.</p>
              </div>
            ) : (
              importantEmails.map((email) => (
                <div key={email.id} className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-xs">
                        {getEmailInitials(email.sender_email)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {email.is_vip && (
                          <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                        )}
                        {email.importance === 'high' && (
                          <ArrowUp className="h-4 w-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium truncate">
                          {email.sender_name || email.sender_email}
                        </span>
                      </div>
                      
                      <h3 className="font-medium text-sm leading-tight mb-2 line-clamp-2">
                        {email.subject}
                      </h3>
                      
                      {email.body_preview && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {email.body_preview}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                        </span>
                        
                        <Button
                          size="sm"
                          onClick={() => handleQuickReply(email)}
                          className="h-7 text-xs"
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Reply
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Bottom padding for mobile navigation */}
        <div className="h-20" />
      </div>

      {/* Reply Assistant Modal */}
      {emailWithMailbox && (
        <EmailReplyAssistant
          open={showReplyAssistant}
          onClose={closeReplyAssistant}
          email={emailWithMailbox}
        />
      )}
    </div>
  );
};

export default MobileEmailBriefing;