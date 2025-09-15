import { useState, useEffect } from "react";
import { ImprovedNavigation } from "@/components/ImprovedNavigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useModules } from "@/hooks/useModules";
import { useUserContext } from "@/hooks/useUserContext";
import { supabase } from "@/integrations/supabase/client";
import { 
  Activity,
  Clock,
  Mail,
  Shield,
  TrendingUp,
  Zap,
  Lock,
  ShoppingCart
} from "lucide-react";

interface MetricsData {
  totalEmailsProcessed: number;
  timesSaved: number; // in minutes
  threatsBlocked: number;
  categoriesCreated: number;
  workflowsExecuted: number;
  avgProcessingTime: number; // in seconds
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, [contextUser]);

  const fetchMetrics = async () => {
    if (!contextUser) return;

    try {
      setLoading(true);
      
      // Get user's tenant_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", contextUser.id)
        .single();

      if (!profile) return;

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