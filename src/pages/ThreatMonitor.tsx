import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Shield, AlertTriangle, Clock, Target, Eye, Mail, Unlock, User, Calendar, ExternalLink } from "lucide-react";

interface ThreatResult {
  id: string;
  email_id: string;
  feed_id: string;
  threat_type: string;
  threat_indicator: string;
  threat_score: number;
  details: any;
  created_at: string;
  tenant_id: string;
  feed_name?: string;
}

interface EmailThreatSummary {
  email_id: string;
  total_threats: number;
  max_threat_score: number;
  quarantined: boolean;
  threat_details: ThreatResult[];
  latest_threat: string;
  email_details?: {
    subject: string;
    sender_email: string;
    sender_name?: string;
    received_at: string;
    processing_status: string;
    mailbox_id: string;
    mailbox_email?: string;
    mailbox_name?: string;
  };
}

import { Navigation } from "@/components/Navigation";

const ThreatMonitor = () => {
  const [threatResults, setThreatResults] = useState<ThreatResult[]>([]);
  const [emailSummaries, setEmailSummaries] = useState<EmailThreatSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalThreats: 0,
    emailsBlocked: 0,
    topThreatType: '',
    avgThreatScore: 0
  });

  useEffect(() => {
    fetchThreatData();
    
    // Set up realtime subscription for threat results
    const channel = supabase
      .channel('threat_monitoring')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'threat_intelligence_results'
        },
        (payload) => {
          console.log('New threat detected:', payload.new);
          toast.error(`🚨 Threat detected: ${payload.new.threat_type} - ${payload.new.threat_indicator}`);
          fetchThreatData(); // Refresh data
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchThreatData = async () => {
    try {
      // Fetch recent threat results with feed names
      const { data: threats, error: threatsError } = await supabase
        .from('threat_intelligence_results')
        .select(`
          *,
          threat_intelligence_feeds(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (threatsError) throw threatsError;

      const threatsWithFeedNames = threats?.map(threat => ({
        ...threat,
        feed_name: threat.threat_intelligence_feeds?.name
      })) || [];

      setThreatResults(threatsWithFeedNames);

      // Group by email and calculate summaries with email details
      const emailGroups = threatsWithFeedNames.reduce((acc, threat) => {
        if (!acc[threat.email_id]) {
          acc[threat.email_id] = [];
        }
        acc[threat.email_id].push(threat);
        return acc;
      }, {} as Record<string, ThreatResult[]>);

      // Fetch email details for each email with threats
      const emailIds = Object.keys(emailGroups);
      const { data: emailDetails, error: emailError } = await supabase
        .from('emails')
        .select(`
          id,
          subject,
          sender_email,
          sender_name,
          received_at,
          processing_status,
          mailbox_id,
          mailboxes(email_address, display_name)
        `)
        .in('id', emailIds);

      if (emailError) {
        console.error('Error fetching email details:', emailError);
      }

      const emailDetailsMap = (emailDetails || []).reduce((acc, email) => {
        acc[email.id] = {
          subject: email.subject,
          sender_email: email.sender_email,
          sender_name: email.sender_name,
          received_at: email.received_at,
          processing_status: email.processing_status,
          mailbox_id: email.mailbox_id,
          mailbox_email: email.mailboxes?.email_address,
          mailbox_name: email.mailboxes?.display_name
        };
        return acc;
      }, {} as Record<string, any>);

      const summaries = Object.entries(emailGroups).map(([emailId, threats]) => ({
        email_id: emailId,
        total_threats: threats.length,
        max_threat_score: Math.max(...threats.map(t => t.threat_score)),
        quarantined: emailDetailsMap[emailId]?.processing_status === 'quarantined',
        threat_details: threats,
        latest_threat: threats[0]?.created_at || '',
        email_details: emailDetailsMap[emailId]
      })).sort((a, b) => new Date(b.latest_threat).getTime() - new Date(a.latest_threat).getTime());

      setEmailSummaries(summaries);

      // Calculate statistics
      const totalThreats = threatsWithFeedNames.length;
      const emailsBlocked = summaries.filter(s => s.quarantined).length;
      
      const threatTypeCounts = threatsWithFeedNames.reduce((acc, threat) => {
        acc[threat.threat_type] = (acc[threat.threat_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topThreatType = Object.entries(threatTypeCounts).reduce((a, b) => 
        threatTypeCounts[a[0]] > threatTypeCounts[b[0]] ? a : b
      )?.[0] || 'None';

      const avgThreatScore = totalThreats > 0 
        ? threatsWithFeedNames.reduce((sum, threat) => sum + threat.threat_score, 0) / totalThreats 
        : 0;

      setStats({
        totalThreats,
        emailsBlocked,
        topThreatType,
        avgThreatScore
      });

    } catch (error) {
      console.error('Error fetching threat data:', error);
      toast.error('Failed to load threat monitoring data');
    } finally {
      setIsLoading(false);
    }
  };

  const getThreatSeverityColor = (score: number) => {
    if (score >= 90) return 'text-red-600 bg-red-100';
    if (score >= 70) return 'text-orange-600 bg-orange-100';
    if (score >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-blue-600 bg-blue-100';
  };

  const releaseFromQuarantine = async (emailId: string) => {
    try {
      console.log('Attempting to release email from quarantine:', emailId);
      
      const { data, error } = await supabase
        .from('emails')
        .update({ processing_status: 'processed' })
        .eq('id', emailId)
        .select();

      console.log('Release result:', { data, error });

      if (error) throw error;

      toast.success('Email released from quarantine');
      fetchThreatData(); // Refresh data
    } catch (error) {
      console.error('Error releasing email from quarantine:', error);
      toast.error(`Failed to release email from quarantine: ${error.message}`);
    }
  };

  const getThreatTypeIcon = (type: string) => {
    switch (type) {
      case 'domain_blocklist': return '🌐';
      case 'url_blocklist': return '🔗';
      case 'ip_blocklist': return '📍';
      case 'phishing_check': return '🎣';
      default: return '⚠️';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto p-6">
          <div>Loading threat monitoring data...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto p-6">
        <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Threat Monitor</h1>
            <p className="text-muted-foreground">
              Real-time monitoring of email threats and security incidents
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Threats Detected</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.totalThreats}</div>
              <div className="text-xs text-muted-foreground">
                Last 24 hours
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Emails Blocked</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.emailsBlocked}</div>
              <div className="text-xs text-muted-foreground">
                Quarantined emails
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Threat Type</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{stats.topThreatType}</div>
              <div className="text-xs text-muted-foreground">
                Most common threat
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Threat Score</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgThreatScore.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">
                Severity level
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quarantined Emails Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-500" />
              Quarantined Emails
            </CardTitle>
            <CardDescription>
              Emails that have been quarantined due to threat detection - review and release if safe
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {emailSummaries.filter(s => s.quarantined).length === 0 ? (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  No emails currently quarantined. All threats have been processed.
                </AlertDescription>
              </Alert>
            ) : (
              emailSummaries
                .filter(summary => summary.quarantined)
                .slice(0, 10)
                .map((summary) => (
                  <div key={summary.email_id} className="border border-red-200 rounded-lg p-4 space-y-4 bg-red-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="destructive">QUARANTINED</Badge>
                        <Badge className={getThreatSeverityColor(summary.max_threat_score)}>
                          Risk: {summary.max_threat_score}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Email Threat Details</DialogTitle>
                              <DialogDescription>
                                Complete analysis of threats detected in this email
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              {summary.email_details && (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <strong>Subject:</strong>
                                      <div className="mt-1 p-2 bg-muted rounded">
                                        {summary.email_details.subject}
                                      </div>
                                    </div>
                                    <div>
                                      <strong>From:</strong>
                                      <div className="mt-1 p-2 bg-muted rounded">
                                        {summary.email_details.sender_name ? 
                                          `${summary.email_details.sender_name} (${summary.email_details.sender_email})` : 
                                          summary.email_details.sender_email
                                        }
                                      </div>
                                    </div>
                                    <div>
                                      <strong>Received:</strong>
                                      <div className="mt-1 p-2 bg-muted rounded flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        {new Date(summary.email_details.received_at).toLocaleString()}
                                      </div>
                                    </div>
                                    <div>
                                      <strong>Mailbox:</strong>
                                      <div className="mt-1 p-2 bg-muted rounded flex items-center gap-2">
                                        <User className="h-4 w-4" />
                                        {summary.email_details.mailbox_name} ({summary.email_details.mailbox_email})
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <h4 className="font-medium">Detected Threats:</h4>
                                    <div className="space-y-2">
                                      {summary.threat_details.map((threat) => (
                                        <div key={threat.id} className="border rounded p-3 space-y-2">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <span>{getThreatTypeIcon(threat.threat_type)}</span>
                                              <span className="font-medium">{threat.feed_name}</span>
                                            </div>
                                            <Badge className={getThreatSeverityColor(threat.threat_score)}>
                                              {threat.threat_score}
                                            </Badge>
                                          </div>
                                          <div className="text-sm">
                                            <strong>Indicator:</strong>
                                            <code className="ml-2 bg-background px-2 py-1 rounded text-xs">
                                              {threat.threat_indicator}
                                            </code>
                                          </div>
                                          {threat.details && (
                                            <div className="text-sm text-muted-foreground">
                                              <strong>Details:</strong> {JSON.stringify(threat.details, null, 2)}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            console.log('Release button clicked for email:', summary.email_id);
                            releaseFromQuarantine(summary.email_id);
                          }}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          <Unlock className="h-4 w-4 mr-1" />
                          Release
                        </Button>
                      </div>
                    </div>

                    {summary.email_details && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                              <Mail className="h-4 w-4" />
                              <strong>Subject:</strong>
                            </div>
                            <div className="truncate">{summary.email_details.subject}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                              <User className="h-4 w-4" />
                              <strong>From:</strong>
                            </div>
                            <div className="truncate">
                              {summary.email_details.sender_name ? 
                                `${summary.email_details.sender_name} (${summary.email_details.sender_email})` : 
                                summary.email_details.sender_email
                              }
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                              <Calendar className="h-4 w-4" />
                              <strong>Received:</strong>
                            </div>
                            <div>{new Date(summary.email_details.received_at).toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                              <ExternalLink className="h-4 w-4" />
                              <strong>Mailbox:</strong>
                            </div>
                            <div className="truncate">
                              {summary.email_details.mailbox_name} ({summary.email_details.mailbox_email})
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Detected Threats ({summary.total_threats}):</div>
                      <div className="grid gap-2">
                        {summary.threat_details.slice(0, 3).map((threat) => (
                          <div key={threat.id} className="flex items-center justify-between text-sm bg-white/80 p-2 rounded border">
                            <div className="flex items-center gap-2">
                              <span>{getThreatTypeIcon(threat.threat_type)}</span>
                              <span className="font-medium">{threat.feed_name}</span>
                              <code className="bg-background px-1 rounded text-xs max-w-xs truncate">
                                {threat.threat_indicator}
                              </code>
                            </div>
                            <Badge className={getThreatSeverityColor(threat.threat_score)}>
                              {threat.threat_score}
                            </Badge>
                          </div>
                        ))}
                        {summary.threat_details.length > 3 && (
                          <div className="text-xs text-muted-foreground text-center py-1">
                            +{summary.threat_details.length - 3} more threats detected
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        {/* All Email Threat Summaries */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              All Email Threat Analysis
            </CardTitle>
            <CardDescription>
              Complete history of emails with threat detections
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {emailSummaries.length === 0 ? (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  No threats detected recently. Your email security is working well!
                </AlertDescription>
              </Alert>
            ) : (
              emailSummaries.slice(0, 20).map((summary) => (
                <div key={summary.email_id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-mono bg-muted px-2 py-1 rounded">
                        {summary.email_id.slice(0, 8)}...
                      </div>
                      <Badge variant={summary.quarantined ? 'destructive' : 'secondary'}>
                        {summary.quarantined ? 'QUARANTINED' : 'ALLOWED'}
                      </Badge>
                      {summary.email_details && (
                        <div className="text-sm text-muted-foreground truncate max-w-md">
                          {summary.email_details.subject}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {new Date(summary.latest_threat).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <span><strong>Threats:</strong> {summary.total_threats}</span>
                    <span><strong>Max Score:</strong> 
                      <Badge className={`ml-1 ${getThreatSeverityColor(summary.max_threat_score)}`}>
                        {summary.max_threat_score}
                      </Badge>
                    </span>
                    {summary.email_details && (
                      <>
                        <span><strong>From:</strong> {summary.email_details.sender_email}</span>
                        <span><strong>Mailbox:</strong> {summary.email_details.mailbox_email}</span>
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Threat Details:</div>
                    <div className="grid gap-2">
                      {summary.threat_details.slice(0, 3).map((threat) => (
                        <div key={threat.id} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded">
                          <div className="flex items-center gap-2">
                            <span>{getThreatTypeIcon(threat.threat_type)}</span>
                            <span className="font-medium">{threat.feed_name}</span>
                            <code className="bg-background px-1 rounded text-xs max-w-xs truncate">
                              {threat.threat_indicator}
                            </code>
                          </div>
                          <Badge className={getThreatSeverityColor(threat.threat_score)}>
                            {threat.threat_score}
                          </Badge>
                        </div>
                      ))}
                      {summary.threat_details.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{summary.threat_details.length - 3} more threats
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        </div>
      </main>
    </div>
  );
};

export default ThreatMonitor;