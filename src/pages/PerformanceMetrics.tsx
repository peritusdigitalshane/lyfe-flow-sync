import { useState, useEffect } from "react";
import { ImprovedNavigation } from "@/components/ImprovedNavigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useModules } from "@/hooks/useModules";
import { useUserContext } from "@/hooks/useUserContext";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { 
  Activity,
  Clock,
  Mail,
  Shield,
  TrendingUp,
  Zap,
  Lock,
  ShoppingCart,
  PieChart,
  Target,
  Users,
  FileText
} from "lucide-react";
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Pie } from "recharts";

interface MetricsData {
  totalEmailsProcessed: number;
  timesSaved: number; // in minutes
  threatsBlocked: number;
  categoriesCreated: number;
  workflowsExecuted: number;
  avgProcessingTime: number; // in seconds
}

interface EmailIntelligenceData {
  classificationAccuracy: number;
  topSenders: Array<{ email: string; count: number; name?: string }>;
  categoryDistribution: Array<{ category: string; count: number; color: string }>;
  spamLegitimateRatio: { spam: number; legitimate: number };
  attachmentStats: { totalFiles: number; totalSize: number; types: Array<{ type: string; count: number }> };
  dailyVolume: Array<{ date: string; count: number }>;
}

export default function PerformanceMetrics() {
  const { hasSecurity } = useModules();
  const { contextUser } = useUserContext();
  const [metrics, setMetrics] = useState<MetricsData>({
    totalEmailsProcessed: 0,
    timesSaved: 0,
    threatsBlocked: 0,
    categoriesCreated: 0,
    workflowsExecuted: 0,
    avgProcessingTime: 0
  });
  const [emailIntelligence, setEmailIntelligence] = useState<EmailIntelligenceData>({
    classificationAccuracy: 0,
    topSenders: [],
    categoryDistribution: [],
    spamLegitimateRatio: { spam: 0, legitimate: 0 },
    attachmentStats: { totalFiles: 0, totalSize: 0, types: [] },
    dailyVolume: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    fetchEmailIntelligence();
  }, [contextUser]);

  const fetchEmailIntelligence = async () => {
    if (!contextUser) return;

    try {
      // Get user's tenant_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", contextUser.id)
        .maybeSingle();

      if (!profile) {
        console.log("No profile found for user");
        return;
      }

      // Fetch email data with more details
      const { data: emailData } = await supabase
        .from("emails")
        .select(`
          id, 
          sender_email, 
          sender_name, 
          received_at, 
          has_attachments,
          processing_status,
          importance
        `)
        .eq("tenant_id", profile.tenant_id)
        .order("received_at", { ascending: false })
        .limit(1000);

      // Fetch email classifications
      const { data: classificationsData } = await supabase
        .from("email_classifications")
        .select(`
          confidence_score,
          classification_method,
          category_id,
          email_categories!inner(name, color)
        `)
        .eq("tenant_id", profile.tenant_id);

      // Fetch categories
      const { data: categoriesData } = await supabase
        .from("email_categories")
        .select("id, name, color")
        .eq("tenant_id", profile.tenant_id);

      if (!emailData || !categoriesData) return;

      // Calculate classification accuracy (emails with confidence > 80%)
      const highConfidenceClassifications = classificationsData?.filter(c => c.confidence_score > 0.8) || [];
      const accuracy = classificationsData?.length > 0 
        ? Math.round((highConfidenceClassifications.length / classificationsData.length) * 100)
        : 0;

      // Top senders analysis
      const senderCounts = emailData.reduce((acc, email) => {
        const key = email.sender_email;
        acc[key] = {
          email: key,
          name: email.sender_name || key,
          count: (acc[key]?.count || 0) + 1
        };
        return acc;
      }, {} as Record<string, { email: string; name: string; count: number }>);

      const topSenders = Object.values(senderCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Category distribution
      const categoryStats = categoriesData.map(category => {
        const categoryClassifications = classificationsData?.filter(
          c => c.category_id === category.id
        ) || [];
        return {
          category: category.name,
          count: categoryClassifications.length,
          color: category.color || '#3b82f6'
        };
      }).filter(c => c.count > 0);

      // Spam/Legitimate ratio (based on importance and patterns)
      const spamEmails = emailData.filter(e => 
        e.importance === 'low' || 
        e.sender_email.includes('noreply') ||
        e.sender_email.includes('no-reply')
      ).length;
      const legitimateEmails = emailData.length - spamEmails;

      // Daily volume for last 7 days
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), i);
        const dayEmails = emailData.filter(e => 
          format(new Date(e.received_at), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        );
        return {
          date: format(date, 'MMM dd'),
          count: dayEmails.length
        };
      }).reverse();

      // Attachment stats
      const emailsWithAttachments = emailData.filter(e => e.has_attachments);
      const attachmentStats = {
        totalFiles: emailsWithAttachments.length,
        totalSize: emailsWithAttachments.length * 2.5, // Estimated 2.5MB average
        types: [
          { type: 'PDF', count: Math.floor(emailsWithAttachments.length * 0.4) },
          { type: 'Images', count: Math.floor(emailsWithAttachments.length * 0.3) },
          { type: 'Documents', count: Math.floor(emailsWithAttachments.length * 0.2) },
          { type: 'Other', count: Math.floor(emailsWithAttachments.length * 0.1) }
        ]
      };

      setEmailIntelligence({
        classificationAccuracy: accuracy,
        topSenders,
        categoryDistribution: categoryStats,
        spamLegitimateRatio: { spam: spamEmails, legitimate: legitimateEmails },
        attachmentStats,
        dailyVolume: last7Days
      });

    } catch (error) {
      console.error("Error fetching email intelligence:", error);
    }
  };

  const fetchMetrics = async () => {
    if (!contextUser) return;

    try {
      setLoading(true);
      
      // Get user's tenant_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", contextUser.id)
        .maybeSingle();

      if (!profile) {
        console.log("No profile found in fetchMetrics");
        return;
      }

      // Fetch email metrics
      const { data: emailData } = await supabase
        .from("emails")
        .select("id, processing_status")
        .eq("tenant_id", profile.tenant_id);

      // Fetch workflow executions
      const { data: workflowData } = await supabase
        .from("workflow_executions")
        .select("execution_time_ms, actions_taken")
        .eq("tenant_id", profile.tenant_id);

      // Fetch email categories
      const { data: categoriesData } = await supabase
        .from("email_categories")
        .select("id")
        .eq("tenant_id", profile.tenant_id);

      // Fetch threat intelligence results (if security module is available)
      let threatData = null;
      if (hasSecurity) {
        const { data } = await supabase
          .from("threat_intelligence_results")
          .select("id")
          .eq("tenant_id", profile.tenant_id);
        threatData = data;
      }

      // Calculate metrics
      const totalEmails = emailData?.length || 0;
      const processedEmails = emailData?.filter(e => e.processing_status === 'processed').length || 0;
      const totalWorkflows = workflowData?.length || 0;
      const totalCategories = categoriesData?.length || 0;
      const totalThreats = threatData?.length || 0;

      // Calculate time saved (estimate 30 seconds saved per processed email + 2 minutes per workflow)
      const timeSavedMinutes = Math.round((processedEmails * 0.5) + (totalWorkflows * 2));

      // Calculate average processing time
      const avgTime = workflowData?.length 
        ? Math.round(workflowData.reduce((acc, w) => acc + w.execution_time_ms, 0) / workflowData.length / 1000)
        : 0;

      setMetrics({
        totalEmailsProcessed: processedEmails,
        timesSaved: timeSavedMinutes,
        threatsBlocked: totalThreats,
        categoriesCreated: totalCategories,
        workflowsExecuted: totalWorkflows,
        avgProcessingTime: avgTime
      });

    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const MetricCard = ({ 
    title, 
    value, 
    description, 
    icon: Icon, 
    trend, 
    disabled = false 
  }: { 
    title: string; 
    value: string | number; 
    description: string; 
    icon: any; 
    trend?: string;
    disabled?: boolean;
  }) => (
    <Card className={disabled ? "opacity-50" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${disabled ? 'text-muted-foreground' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {disabled ? (
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <span className="text-muted-foreground">Disabled</span>
            </div>
          ) : (
            value
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {disabled ? "Security module required" : description}
        </p>
        {trend && !disabled && (
          <Badge variant="outline" className="mt-2 text-xs">
            <TrendingUp className="h-3 w-3 mr-1" />
            {trend}
          </Badge>
        )}
        {disabled && (
          <Button size="sm" variant="outline" className="mt-2">
            <ShoppingCart className="h-3 w-3 mr-1" />
            Purchase Security Module
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <ImprovedNavigation />
      
      <main className="container mx-auto px-4 py-8">
        <Breadcrumbs />

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Performance Metrics</h1>
          <p className="text-muted-foreground">
            Track your productivity gains and system performance across all platform features.
          </p>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-full"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Primary Metrics */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
              <MetricCard
                title="Time Saved"
                value={formatTime(metrics.timesSaved)}
                description="Estimated time saved through automation"
                icon={Clock}
                trend="This month"
              />
              
              <MetricCard
                title="Emails Processed"
                value={metrics.totalEmailsProcessed.toLocaleString()}
                description="Successfully processed and classified"
                icon={Mail}
                trend="Total processed"
              />
              
              <MetricCard
                title="Threats Blocked"
                value={hasSecurity ? metrics.threatsBlocked.toLocaleString() : 0}
                description="Security threats identified and blocked"
                icon={Shield}
                disabled={!hasSecurity}
                trend={hasSecurity ? "Security events" : undefined}
              />
            </div>

            {/* Secondary Metrics */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <MetricCard
                title="Workflows Executed"
                value={metrics.workflowsExecuted.toLocaleString()}
                description="Automated workflow runs completed"
                icon={Zap}
                trend="Total executions"
              />
              
              <MetricCard
                title="Categories Created"
                value={metrics.categoriesCreated.toLocaleString()}
                description="Email organization categories defined"
                icon={Activity}
                trend="Active categories"
              />
              
              <MetricCard
                title="Avg Processing Time"
                value={`${metrics.avgProcessingTime}s`}
                description="Average time per workflow execution"
                icon={TrendingUp}
                trend="Performance metric"
              />
            </div>

            {/* Email Intelligence Section */}
            <div className="mt-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Target className="h-6 w-6" />
                Email Intelligence
              </h2>
              
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <MetricCard
                  title="Classification Accuracy"
                  value={`${emailIntelligence.classificationAccuracy}%`}
                  description="AI confidence score above 80%"
                  icon={Target}
                  trend="High confidence"
                />
                
                <MetricCard
                  title="Daily Email Volume"
                  value={emailIntelligence.dailyVolume.reduce((acc, day) => acc + day.count, 0)}
                  description="Last 7 days total"
                  icon={Mail}
                  trend="Recent activity"
                />
                
                <MetricCard
                  title="Attachments Processed"
                  value={emailIntelligence.attachmentStats.totalFiles.toLocaleString()}
                  description={`~${emailIntelligence.attachmentStats.totalSize.toFixed(1)}MB processed`}
                  icon={FileText}
                  trend="File handling"
                />
                
                <MetricCard
                  title="Unique Senders"
                  value={emailIntelligence.topSenders.length.toLocaleString()}
                  description="Active email sources"
                  icon={Users}
                  trend="Communication scope"
                />
              </div>

              {/* Charts Grid */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Top Senders */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Top Email Senders
                    </CardTitle>
                    <CardDescription>Most frequent email sources</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {emailIntelligence.topSenders.slice(0, 5).map((sender, index) => (
                        <div key={sender.email} className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {sender.name}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {sender.email}
                            </p>
                          </div>
                          <Badge variant="outline" className="ml-2">
                            {sender.count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Category Distribution */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      Category Distribution
                    </CardTitle>
                    <CardDescription>Email classification breakdown</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {emailIntelligence.categoryDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <RechartsPieChart>
                          <Pie
                            data={emailIntelligence.categoryDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            dataKey="count"
                          >
                            {emailIntelligence.categoryDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-48 text-muted-foreground">
                        No classification data available
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Email Quality Ratio */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Email Quality
                    </CardTitle>
                    <CardDescription>Spam vs legitimate ratio</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Legitimate</span>
                        <Badge variant="default" className="bg-green-500">
                          {emailIntelligence.spamLegitimateRatio.legitimate}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Promotional/Spam</span>
                        <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                          {emailIntelligence.spamLegitimateRatio.spam}
                        </Badge>
                      </div>
                      <div className="mt-4">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${
                                (emailIntelligence.spamLegitimateRatio.legitimate / 
                                (emailIntelligence.spamLegitimateRatio.legitimate + emailIntelligence.spamLegitimateRatio.spam)) * 100
                              }%`
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {Math.round(
                            (emailIntelligence.spamLegitimateRatio.legitimate / 
                            (emailIntelligence.spamLegitimateRatio.legitimate + emailIntelligence.spamLegitimateRatio.spam)) * 100
                          )}% legitimate emails
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Daily Volume Chart */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Daily Email Volume
                  </CardTitle>
                  <CardDescription>Email activity over the last 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={emailIntelligence.dailyVolume}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Productivity Summary */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Productivity Summary
                </CardTitle>
                <CardDescription>
                  Your email management efficiency at a glance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <h3 className="font-medium">Daily Time Savings</h3>
                      <p className="text-sm text-muted-foreground">
                        Based on automated email processing and workflows
                      </p>
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {formatTime(Math.round(metrics.timesSaved / 30))}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <h3 className="font-medium">Security Protection</h3>
                      <p className="text-sm text-muted-foreground">
                        {hasSecurity ? "Active threat monitoring and protection" : "Upgrade to Security module for protection"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasSecurity ? (
                        <Badge variant="default" className="bg-green-500">
                          <Shield className="h-3 w-3 mr-1" />
                          Protected
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Lock className="h-3 w-3 mr-1" />
                          Not Active
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}