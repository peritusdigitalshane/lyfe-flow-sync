import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Activity, Clock, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MailboxInfo {
  id: string;
  email_address: string;
  display_name: string;
  status: string;
  last_sync_at: string | null;
}

interface ActivityLog {
  id: string;
  action: string;
  details: any;
  created_at: string;
  ip_address: unknown;
  user_agent: string | null;
}

interface EmailCategory {
  id: string;
  name: string;
  color: string;
}

export default function MailboxActivity() {
  const { mailboxId } = useParams<{ mailboxId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [mailbox, setMailbox] = useState<MailboxInfo | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [categories, setCategories] = useState<EmailCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user && mailboxId) {
      fetchMailboxData();
      fetchActivityLogs();
      fetchCategories();
    }
  }, [user, authLoading, mailboxId]);

  const fetchMailboxData = async () => {
    if (!mailboxId) return;

    try {
      const { data, error } = await supabase
        .from("mailboxes")
        .select("id, email_address, display_name, status, last_sync_at")
        .eq("id", mailboxId)
        .single();

      if (error) {
        console.error("Error fetching mailbox:", error);
        toast({
          title: "Error",
          description: "Failed to load mailbox information",
          variant: "destructive",
        });
        return;
      }

      setMailbox(data);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const fetchActivityLogs = async () => {
    if (!mailboxId) return;

    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, details, created_at, ip_address, user_agent")
        .eq("mailbox_id", mailboxId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error fetching activity logs:", error);
        toast({
          title: "Error",
          description: "Failed to load activity logs",
          variant: "destructive",
        });
        return;
      }

      setActivityLogs(data || []);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const fetchCategories = async () => {
    if (!mailboxId) return;

    try {
      // Fetch both mailbox-specific categories AND global categories (mailbox_id is null)
      const { data, error } = await supabase
        .from("email_categories")
        .select("id, name, color")
        .or(`mailbox_id.eq.${mailboxId},mailbox_id.is.null`);

      if (error) {
        console.error("Error fetching categories:", error);
        return;
      }

      setCategories(data || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge variant="default" className="bg-status-success text-white"><CheckCircle2 className="h-3 w-3 mr-1" />Connected</Badge>;
      case "paused":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Paused</Badge>;
      case "error":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      case "pending":
        return <Badge variant="outline"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case "mailbox_created":
        return <CheckCircle2 className="h-4 w-4 text-status-success" />;
      case "mailbox_connected":
        return <CheckCircle2 className="h-4 w-4 text-status-success" />;
      case "mailbox_paused":
        return <Clock className="h-4 w-4 text-status-warning" />;
      case "mailbox_resumed":
        return <CheckCircle2 className="h-4 w-4 text-status-success" />;
      case "workflow_created":
        return <Activity className="h-4 w-4 text-primary" />;
      case "workflow_activated":
        return <CheckCircle2 className="h-4 w-4 text-status-success" />;
      case "workflow_deactivated":
        return <Clock className="h-4 w-4 text-status-warning" />;
      case "email_received":
        return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
      case "email_categorized":
        return <Activity className="h-4 w-4 text-purple-600" />;
      case "email_processed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : `Unknown Category (${categoryId.slice(0, 8)}...)`;
  };

  const getCategoryBadge = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) {
      return <Badge variant="outline">Unknown Category</Badge>;
    }
    
    return (
      <Badge 
        variant="outline" 
        style={{ 
          borderColor: category.color,
          color: category.color,
          backgroundColor: `${category.color}10`
        }}
      >
        {category.name}
      </Badge>
    );
  };

  const formatActivityDetails = (action: string, details: any) => {
    if (!details || typeof details !== 'object') return details;

    const formatted = { ...details };

    // For email categorization, add the category name
    if (action === 'email_categorized' && details.category_id) {
      formatted.category_name = getCategoryName(details.category_id);
    }

    return formatted;
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!mailbox) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Mailbox Not Found</h2>
              <p className="text-muted-foreground mb-4">The requested mailbox could not be found.</p>
              <Link to="/dashboard">
                <Button>Return to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Mailbox Info */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">{mailbox.display_name}</CardTitle>
                <p className="text-muted-foreground">{mailbox.email_address}</p>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(mailbox.status)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm mb-1">Status</h4>
                <p className="text-sm text-muted-foreground">{formatAction(mailbox.status)}</p>
              </div>
              <div>
                <h4 className="font-medium text-sm mb-1">Last Sync</h4>
                <p className="text-sm text-muted-foreground">
                  {mailbox.last_sync_at ? formatDate(mailbox.last_sync_at) : "Never synced"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activityLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No activity logs found for this mailbox.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="mt-1">
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-sm">{formatAction(log.action)}</h4>
                        <span className="text-xs text-muted-foreground">{formatDate(log.created_at)}</span>
                      </div>
                      {log.details && (
                        <div className="text-sm text-muted-foreground mb-2">
                          {/* Special handling for email categorization */}
                          {log.action === 'email_categorized' && log.details.category_id && (
                            <div className="mb-2">
                              <span className="text-sm font-medium">Category assigned: </span>
                              {getCategoryBadge(log.details.category_id)}
                            </div>
                          )}
                          
                          {typeof log.details === 'object' ? (
                            <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                              {JSON.stringify(formatActivityDetails(log.action, log.details), null, 2)}
                            </pre>
                          ) : (
                            <p>{log.details}</p>
                          )}
                        </div>
                      )}
                      {log.ip_address && (
                        <div className="text-xs text-muted-foreground">
                          IP: {String(log.ip_address)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}