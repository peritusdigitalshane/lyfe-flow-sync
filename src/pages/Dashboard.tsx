import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Plus, Settings, Activity, Pause, Play, Trash2 } from "lucide-react";

interface Mailbox {
  id: string;
  email_address: string;
  display_name: string;
  status: "pending" | "connected" | "error" | "paused";
  error_message?: string;
  last_sync_at?: string;
}

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMailboxes();
    }
  }, [user]);

  const fetchMailboxes = async () => {
    try {
      const { data, error } = await supabase
        .from("mailboxes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMailboxes(data || []);
    } catch (error) {
      console.error("Error fetching mailboxes:", error);
      toast.error("Failed to load mailboxes");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMailboxState = async (mailboxId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "paused" ? "connected" : "paused";
      const session = await supabase.auth.getSession();
      
      const response = await fetch(`/supabase/functions/v1/mailbox-api/${mailboxId}/state`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.data.session?.access_token}`,
        },
        body: JSON.stringify({ action: newStatus === "paused" ? "pause" : "resume" }),
      });

      if (!response.ok) throw new Error("Failed to toggle mailbox state");

      setMailboxes(prev => 
        prev.map(mb => 
          mb.id === mailboxId ? { ...mb, status: newStatus as any } : mb
        )
      );
      
      toast.success(`Mailbox ${newStatus === "paused" ? "paused" : "resumed"}`);
    } catch (error) {
      toast.error("Failed to toggle mailbox state");
    }
  };

  const deleteMailbox = async (mailboxId: string) => {
    try {
      const { error } = await supabase
        .from("mailboxes")
        .delete()
        .eq("id", mailboxId);

      if (error) throw error;

      setMailboxes(prev => prev.filter(mb => mb.id !== mailboxId));
      toast.success("Mailbox deleted successfully");
    } catch (error) {
      console.error("Error deleting mailbox:", error);
      toast.error("Failed to delete mailbox");
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      connected: "default",
      error: "destructive",
      paused: "secondary",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Lyfe Email Management</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user.email}
            </span>
            <Link to="/settings">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
            <Button variant="outline" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Your Mailboxes</h2>
            <p className="text-muted-foreground">
              Manage your connected email accounts and automation workflows
            </p>
          </div>
          <Link to="/add-mailbox">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Mailbox
            </Button>
          </Link>
        </div>

        {mailboxes.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No mailboxes connected</h3>
              <p className="text-muted-foreground mb-4">
                Get started by connecting your first email account
              </p>
              <Link to="/add-mailbox">
                <Button>Add Your First Mailbox</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mailboxes.map((mailbox) => (
              <Card key={mailbox.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{mailbox.display_name}</CardTitle>
                      <CardDescription>{mailbox.email_address}</CardDescription>
                    </div>
                    {getStatusBadge(mailbox.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  {mailbox.error_message && (
                    <div className="text-sm text-destructive mb-4 p-2 bg-destructive/10 rounded">
                      {mailbox.error_message}
                    </div>
                  )}
                  
                  {mailbox.last_sync_at && (
                    <p className="text-xs text-muted-foreground mb-4">
                      Last sync: {new Date(mailbox.last_sync_at).toLocaleString()}
                    </p>
                  )}

                  <div className="flex gap-2">
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

                    {mailbox.status === "pending" || mailbox.status === "error" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-destructive hover:text-destructive"
                        onClick={() => deleteMailbox(mailbox.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    ) : null}
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