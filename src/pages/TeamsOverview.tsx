import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserContext } from "@/hooks/useUserContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, Clock, CheckCircle2, AlertCircle, Settings, Bot, FileText } from "lucide-react";
import { toast } from "sonner";
import { ModuleGuard } from "@/components/ModuleGuard";
import { ImprovedNavigation } from "@/components/ImprovedNavigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";

interface MeetingSummary {
  id: string;
  meeting_title: string;
  meeting_date: string;
  duration_minutes: number;
  participants: string[];
  summary: string;
  action_items: any[];
  effectiveness_score: number;
  integration_type: 'transcription' | 'bot';
}

interface ActionItem {
  id: string;
  description: string;
  assigned_to: string;
  due_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
}

// Database types
interface DbMeetingSummary {
  id: string;
  meeting_title: string;
  meeting_date: string;
  duration_minutes: number;
  participants: any;
  summary: string;
  action_items: any;
  effectiveness_score: number;
  integration_type: string;
}

interface DbActionItem {
  id: string;
  description: string;
  assigned_to: string;
  due_date: string;
  status: string;
  priority: string;
}

interface DbTeamsSettings {
  integration_type: string;
  auto_transcription_enabled: boolean;
  meeting_analytics_enabled: boolean;
  action_item_extraction: boolean;
  speaking_time_analysis: boolean;
  bot_enabled: boolean;
  bot_name: string;
}

interface TeamsSettings {
  integration_type: 'transcription' | 'bot' | 'both';
  auto_transcription_enabled: boolean;
  meeting_analytics_enabled: boolean;
  action_item_extraction: boolean;
  speaking_time_analysis: boolean;
  bot_enabled: boolean;
  bot_name: string;
}

export default function TeamsOverview() {
  const { user } = useAuth();
  const { contextUser } = useUserContext();
  const [meetingSummaries, setMeetingSummaries] = useState<MeetingSummary[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [teamsSettings, setTeamsSettings] = useState<TeamsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMeetings: 0,
    totalHours: 0,
    completedActions: 0,
    pendingActions: 0,
    avgEffectiveness: 0
  });

  const fetchTeamsData = async () => {
    if (!contextUser) return;

    try {
      setLoading(true);

      // Fetch teams settings
      const { data: settings } = await supabase
        .from("teams_settings")
        .select("*")
        .eq("user_id", contextUser.id)
        .maybeSingle();

      if (settings) {
        const typedSettings: TeamsSettings = {
          integration_type: settings.integration_type as 'transcription' | 'bot' | 'both',
          auto_transcription_enabled: settings.auto_transcription_enabled,
          meeting_analytics_enabled: settings.meeting_analytics_enabled,
          action_item_extraction: settings.action_item_extraction,
          speaking_time_analysis: settings.speaking_time_analysis,
          bot_enabled: settings.bot_enabled,
          bot_name: settings.bot_name
        };
        setTeamsSettings(typedSettings);
      }

      // Fetch recent meeting summaries
      const { data: summaries, error: summariesError } = await supabase
        .from("meeting_summaries")
        .select("*")
        .order("meeting_date", { ascending: false })
        .limit(10);

      if (summariesError) throw summariesError;
      
      const typedSummaries: MeetingSummary[] = (summaries || []).map((s: any) => ({
        id: s.id,
        meeting_title: s.meeting_title,
        meeting_date: s.meeting_date,
        duration_minutes: s.duration_minutes,
        participants: Array.isArray(s.participants) ? s.participants : [],
        summary: s.summary,
        action_items: Array.isArray(s.action_items) ? s.action_items : [],
        effectiveness_score: s.effectiveness_score,
        integration_type: s.integration_type as 'transcription' | 'bot'
      }));
      setMeetingSummaries(typedSummaries);

      // Fetch action items
      const { data: actions, error: actionsError } = await supabase
        .from("meeting_action_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (actionsError) throw actionsError;
      
      const typedActions: ActionItem[] = (actions || []).map((a: any) => ({
        id: a.id,
        description: a.description,
        assigned_to: a.assigned_to,
        due_date: a.due_date,
        status: a.status as 'pending' | 'in_progress' | 'completed' | 'cancelled',
        priority: a.priority as 'low' | 'medium' | 'high'
      }));
      setActionItems(typedActions);

      // Calculate stats
      const totalHours = summaries?.reduce((acc, meeting) => acc + (meeting.duration_minutes || 0), 0) || 0;
      const completedActions = actions?.filter(item => item.status === 'completed').length || 0;
      const pendingActions = actions?.filter(item => item.status === 'pending').length || 0;
      const avgEffectiveness = summaries?.length 
        ? summaries.reduce((acc, meeting) => acc + (meeting.effectiveness_score || 0), 0) / summaries.length
        : 0;

      setStats({
        totalMeetings: summaries?.length || 0,
        totalHours: Math.round(totalHours / 60),
        completedActions,
        pendingActions,
        avgEffectiveness: Math.round(avgEffectiveness)
      });

    } catch (error) {
      console.error("Error fetching teams data:", error);
      toast.error("Failed to load teams data");
    } finally {
      setLoading(false);
    }
  };

  const initializeTeamsSettings = async () => {
    if (!contextUser) return;

    try {
      // Get tenant_id from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", contextUser.id)
        .single();

      const { error } = await supabase
        .from("teams_settings")
        .insert({
          user_id: contextUser.id,
          tenant_id: profile?.tenant_id,
          integration_type: 'transcription',
          auto_transcription_enabled: true,
          meeting_analytics_enabled: true,
          action_item_extraction: true,
          speaking_time_analysis: false,
          bot_enabled: false,
          bot_name: 'Meeting Assistant'
        });

      if (error) throw error;
      
      toast.success("Teams settings initialized");
      fetchTeamsData();
    } catch (error) {
      console.error("Error initializing teams settings:", error);
      toast.error("Failed to initialize teams settings");
    }
  };

  useEffect(() => {
    fetchTeamsData();
  }, [contextUser]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-orange-600 bg-orange-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ImprovedNavigation />
      
      <ModuleGuard requiredModule="teams">
        <main className="container mx-auto px-4 py-8">
          <Breadcrumbs />
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold">Teams Integration</h1>
              <p className="text-muted-foreground">Meeting intelligence and analytics for Microsoft Teams</p>
            </div>
            <Button onClick={() => window.location.href = '/teams-settings'} variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>

        {!teamsSettings ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Get Started with Teams Integration</CardTitle>
              <CardDescription>
                Choose how you want to integrate with Microsoft Teams for meeting intelligence
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">Option 1: Transcription Analytics</h3>
                      <p className="text-sm text-muted-foreground">Use Teams transcripts for AI analysis</p>
                    </div>
                  </div>
                  <ul className="text-sm space-y-1 mb-4">
                    <li>• Meeting summaries</li>
                    <li>• Action item extraction</li>
                    <li>• Speaking time analysis</li>
                    <li>• Effectiveness scoring</li>
                  </ul>
                  <Badge variant="secondary">Requires transcription enabled</Badge>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <Bot className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">Option 2: Bot Integration</h3>
                      <p className="text-sm text-muted-foreground">Deploy meeting assistant bot</p>
                    </div>
                  </div>
                  <ul className="text-sm space-y-1 mb-4">
                    <li>• Auto-join meetings</li>
                    <li>• Real-time recording</li>
                    <li>• Independent transcription</li>
                    <li>• Custom prompts</li>
                  </ul>
                  <Badge variant="secondary">Requires bot deployment</Badge>
                </Card>
              </div>
              
              <Button onClick={initializeTeamsSettings} className="w-full">
                Initialize Teams Integration
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid md:grid-cols-5 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{stats.totalMeetings}</p>
                      <p className="text-xs text-muted-foreground">Total Meetings</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{stats.totalHours}h</p>
                      <p className="text-xs text-muted-foreground">Meeting Time</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.completedActions}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <div>
                      <p className="text-2xl font-bold">{stats.pendingActions}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{stats.avgEffectiveness}%</p>
                      <p className="text-xs text-muted-foreground">Effectiveness</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content */}
            <Tabs defaultValue="summaries" className="space-y-4">
              <TabsList>
                <TabsTrigger value="summaries">Meeting Summaries</TabsTrigger>
                <TabsTrigger value="actions">Action Items</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="summaries" className="space-y-4">
                {meetingSummaries.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No meetings yet</h3>
                        <p className="text-muted-foreground mb-4">
                          Start a Teams meeting with transcription enabled to see summaries here
                        </p>
                        <Button variant="outline">
                          Learn How to Enable Transcription
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {meetingSummaries.map((meeting) => (
                      <Card key={meeting.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{meeting.meeting_title}</CardTitle>
                              <CardDescription>
                                {new Date(meeting.meeting_date).toLocaleDateString()} • 
                                {meeting.duration_minutes} minutes • 
                                {meeting.participants.length} participants
                              </CardDescription>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={meeting.integration_type === 'bot' ? 'default' : 'secondary'}>
                                {meeting.integration_type}
                              </Badge>
                              {meeting.effectiveness_score && (
                                <Badge variant="outline">
                                  {meeting.effectiveness_score}% effective
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-4">{meeting.summary}</p>
                          {meeting.action_items.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-sm mb-2">Action Items:</h4>
                              <ul className="space-y-1">
                                {meeting.action_items.slice(0, 3).map((action: any, index: number) => (
                                  <li key={index} className="text-sm flex items-center space-x-2">
                                    <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                                    <span>{action.description}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="actions" className="space-y-4">
                {actionItems.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center py-8">
                        <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No action items yet</h3>
                        <p className="text-muted-foreground">
                          Action items will appear here when extracted from meeting transcripts
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {actionItems.map((item) => (
                      <Card key={item.id}>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="font-medium">{item.description}</p>
                              <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                                <span>Assigned to: {item.assigned_to || 'Unassigned'}</span>
                                {item.due_date && (
                                  <span>Due: {new Date(item.due_date).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className={getPriorityColor(item.priority)}>
                                {item.priority}
                              </Badge>
                              <Badge className={getStatusColor(item.status)}>
                                {item.status.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Analytics Dashboard</CardTitle>
                    <CardDescription>Coming soon - detailed meeting analytics and insights</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-semibold">Meeting Patterns</h4>
                        <p className="text-sm text-muted-foreground">
                          Track meeting frequency, duration trends, and optimal meeting times
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold">Productivity Insights</h4>
                        <p className="text-sm text-muted-foreground">
                          Analyze action item completion rates and meeting effectiveness over time
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
          </Tabs>
        </>
      )}
        </main>
      </ModuleGuard>
    </div>
  );
}