import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Settings, Play, Pause, Trash2, Plus, User, LogOut, Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AccountStatusCheck from "@/components/AccountStatusCheck";

interface Mailbox {
  id: string;
  email_address: string;
  display_name: string;
  status: "pending" | "connected" | "error" | "paused";
  error_message?: string;
  last_sync_at?: string;
}

import { Navigation } from "@/components/Navigation";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin } = useRoles();
  const { toast } = useToast();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user) {
      fetchMailboxes();
    }
  }, [user, authLoading]);

  // Remove the old auth checks - AccountStatusCheck handles them now

  const fetchMailboxes = async () => {
    try {
      const { data, error } = await supabase
        .from("mailboxes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching mailboxes:", error);
        toast({
          title: "Error",
          description: "Failed to load mailboxes",
          variant: "destructive",
        });
        return;
      }

      setMailboxes(data || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMailboxState = async (mailboxId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "connected" ? "paused" : "connected";
      
      const { error } = await supabase
        .from("mailboxes")
        .update({ status: newStatus })
        .eq("id", mailboxId);

      if (error) {
        console.error("Error toggling mailbox:", error);
        toast({
          title: "Error",
          description: "Failed to update mailbox status",
          variant: "destructive",
        });
        return;
      }

      await fetchMailboxes();
      toast({
        title: "Success",
        description: `Mailbox ${newStatus === "connected" ? "resumed" : "paused"} successfully`,
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const deleteMailbox = async (mailboxId: string) => {
    if (!confirm("Are you sure you want to delete this mailbox?")) return;

    try {
      const { error } = await supabase
        .from("mailboxes")
        .delete()
        .eq("id", mailboxId);

      if (error) {
        console.error("Error deleting mailbox:", error);
        toast({
          title: "Error",
          description: "Failed to delete mailbox",
          variant: "destructive",
        });
        return;
      }

      await fetchMailboxes();
      toast({
        title: "Success",
        description: "Mailbox deleted successfully",
      });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge variant="default" className="bg-status-success text-white">Connected</Badge>;
      case "paused":
        return <Badge variant="secondary">Paused</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading mailboxes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Manage your connected mailboxes and monitor email automation workflows
            </p>
          </div>
          <Button asChild variant="premium" className="gap-2">
            <Link to="/add-mailbox">
              <Plus className="h-4 w-4" />
              Add Mailbox
            </Link>
          </Button>
        </div>

        {mailboxes.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-primary rounded-full mx-auto mb-4 flex items-center justify-center">
                <Plus className="h-8 w-8 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No mailboxes connected</h3>
              <p className="text-muted-foreground mb-6">
                Get started by connecting your first mailbox to begin email automation
              </p>
              <Button asChild variant="premium" size="lg" className="gap-2">
                <Link to="/add-mailbox">
                  <Plus className="h-5 w-5" />
                  Connect Your First Mailbox
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {mailboxes.map((mailbox) => (
              <Card key={mailbox.id} className="card-neon">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{mailbox.display_name}</CardTitle>
                      <CardDescription className="mt-1">
                        {mailbox.email_address}
                      </CardDescription>
                    </div>
                    {getStatusBadge(mailbox.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  {mailbox.error_message && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                      <p className="text-sm text-destructive">{mailbox.error_message}</p>
                    </div>
                  )}
                  
                  {mailbox.last_sync_at && (
                    <div className="mb-4 text-sm text-muted-foreground">
                      Last sync: {new Date(mailbox.last_sync_at).toLocaleString()}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Link to={`/mailbox/${mailbox.id}/settings`}>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Settings className="h-3 w-3" />
                        Settings
                      </Button>
                    </Link>
                    
                    <Link to={`/mailbox/${mailbox.id}/activity`}>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Activity className="h-3 w-3" />
                        Activity
                      </Button>
                    </Link>

                    {mailbox.status === "connected" || mailbox.status === "paused" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => toggleMailboxState(mailbox.id, mailbox.status)}
                      >
                        {mailbox.status === "paused" ? (
                          <><Play className="h-3 w-3" /> Resume</>
                        ) : (
                          <><Pause className="h-3 w-3" /> Pause</>
                        )}
                      </Button>
                    ) : null}

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-destructive hover:text-destructive"
                      onClick={() => deleteMailbox(mailbox.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}