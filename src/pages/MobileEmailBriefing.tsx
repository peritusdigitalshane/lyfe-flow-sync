import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
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
  CheckCircle2,
  Target,
  X,
  RotateCcw,
  Home
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
  const navigate = useNavigate();
  
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
  const [insights, setInsights] = useState<string[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [vipEmails, setVipEmails] = useState<ImportantEmail[]>([]);
  const [hiddenInsights, setHiddenInsights] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (user) {
      fetchEmailBriefing();
      fetchEmailInsights();
      // Process VIP emails for any that might not be flagged correctly
      processVipEmails();
    }
  }, [user]);

  const processVipEmails = async () => {
    try {
      // Get user's tenant_id
      const { data: profileData } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();
        
      if (!profileData) return;
      
      // Call VIP update function to process all mailboxes
      await supabase.functions.invoke('update-vip-status', {
        body: {
          action: 'process_mailbox',
          mailbox_id: null, // Will process all mailboxes
          tenant_id: profileData.tenant_id
        }
      });
      
      console.log('VIP processing completed');
    } catch (error) {
      console.error('Error processing VIP emails:', error);
    }
  };

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

      // Get VIP emails specifically
      const vipEmailsOnly = recentEmails?.filter(email => email.is_vip).slice(0, 5) || [];

      console.log('Important emails found:', important.length);
      console.log('VIP emails found:', vipEmailsOnly.length);

      setImportantEmails(important);
      setVipEmails(vipEmailsOnly);

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

  const fetchEmailInsights = async () => {
    try {
      setInsightsLoading(true);
      console.log('Fetching AI insights for last 24 hours');
      
      const { data, error } = await supabase.functions.invoke('email-insights-analyzer', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) {
        console.error('Error fetching insights:', error);
        return;
      }

      console.log('AI insights response:', data);
      setInsights(data.insights || []);
    } catch (error) {
      console.error('Error fetching email insights:', error);
    } finally {
      setInsightsLoading(false);
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

  const hideInsight = (index: number) => {
    setHiddenInsights(prev => new Set(prev).add(index));
  };

  const showAllInsights = () => {
    setHiddenInsights(new Set());
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-muted"
            >
              <Home className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 flex-1">
              <Smartphone className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Email Briefing</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const { data: profileData } = await supabase
                    .from('profiles')
                    .select('tenant_id')
                    .eq('id', user?.id)
                    .single();
                  
                  if (!profileData) return;
                  
                  toast({
                    title: "Fixing VIP database...",
                    description: "Updating VIP status directly in database"
                  });
                  
                  const { data, error } = await supabase.functions.invoke('fix-vip-database', {
                    body: {
                      tenant_id: profileData.tenant_id
                    }
                  });
                  
                  console.log('VIP database fix response:', { data, error });
                  
                  if (error) {
                    console.error('VIP database fix error:', error);
                    toast({
                      title: "Error",
                      description: `Failed to fix VIP database: ${error.message}`,
                      variant: "destructive"
                    });
                    return;
                  }
                  
                  // Wait a moment then refresh the data
                  setTimeout(async () => {
                    await fetchEmailBriefing();
                    toast({
                      title: "VIP database fixed!",
                      description: `Updated ${data?.updated || 0} emails. VIP emails should now appear.`
                    });
                  }, 1000);
                  
                } catch (error) {
                  console.error('Error fixing VIP database:', error);
                  toast({
                    title: "Error",
                    description: "Failed to fix VIP database",
                    variant: "destructive"
                  });
                }
              }}
              className="text-xs"
            >
              🔧 Fix VIP DB
            </Button>
            <Badge variant="outline">
              <Clock className="h-3 w-3 mr-1" />
              {formatDistanceToNow(new Date(), { addSuffix: true })}
            </Badge>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Today's Focus */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Today's Focus</CardTitle>
              </div>
              {hiddenInsights.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={showAllInsights}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Show hidden ({hiddenInsights.size})
                </Button>
              )}
            </div>
            <CardDescription>
              Key actions to maximize your productivity today
            </CardDescription>
          </CardHeader>
          <CardContent>
            {insightsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-full mb-2" />
                    <div className="h-3 bg-muted rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : insights.filter((_, index) => !hiddenInsights.has(index)).length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm font-medium">
                  {insights.length === 0 ? "Great job!" : "All insights handled!"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {insights.length === 0 
                    ? "No urgent actions needed right now" 
                    : "You've dismissed all insights for now"
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {insights.map((insight, index) => (
                  !hiddenInsights.has(index) && (
                    <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Zap className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-800 leading-relaxed font-medium flex-1">{insight}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => hideInsight(index)}
                        className="h-7 w-7 p-0 text-blue-400 hover:text-blue-600 hover:bg-blue-100 flex-shrink-0"
                        title="Mark as handled"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                ))}
              </div>
            )}
          </CardContent>
        </Card>


        {/* VIP Emails Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              VIP Communications
            </CardTitle>
            <CardDescription>
              Important emails from your VIP contacts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
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
            ) : vipEmails.length === 0 ? (
              <div className="text-center py-6">
                <Star className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                <p className="text-sm font-medium">No VIP emails</p>
                <p className="text-xs text-muted-foreground">No recent emails from VIP contacts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {vipEmails.map((email) => (
                  <div key={email.id} className="border rounded-lg p-3 bg-yellow-50 border-yellow-200">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-xs bg-yellow-100">
                          {getEmailInitials(email.sender_email)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />
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
                            className="h-7 text-xs bg-yellow-600 hover:bg-yellow-700"
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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