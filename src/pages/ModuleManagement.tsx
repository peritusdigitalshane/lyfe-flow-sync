import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Navigation } from "@/components/Navigation";
import { ImprovedNavigation } from "@/components/ImprovedNavigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Plus, Shield, Mail, Calendar, User, Trash2, Edit, Users } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type UserModule = Database['public']['Enums']['user_module'];

interface UserModuleAccess {
  id: string;
  user_id: string;
  module: UserModule;
  is_active: boolean;
  expires_at?: string;
  granted_at: string;
  granted_by?: string;
  user_email?: string;
  user_name?: string;
  granted_by_email?: string;
}

interface Profile {
  id: string;
  email: string;
  full_name?: string;
  tenant_id: string;
}

const moduleInfo = {
  email_management: {
    name: 'Email Management',
    description: 'Core email management features including categories, workflows, and AI classification',
    icon: Mail,
    color: 'bg-primary/10 text-primary border-primary/20',
    defaultEnabled: true,
  },
  security: {
    name: 'Security Module',
    description: 'Advanced security features including threat intelligence and monitoring',
    icon: Shield,
    color: 'bg-destructive/10 text-destructive border-destructive/20',
    defaultEnabled: false,
  },
};

export default function ModuleManagement() {
  const { user } = useAuth();
  const { isSuperAdmin, isAdmin } = useRoles();
  const [moduleAccess, setModuleAccess] = useState<UserModuleAccess[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<UserModule>('email_management');
  const [expiresAt, setExpiresAt] = useState<string>('');

  useEffect(() => {
    if (isSuperAdmin || isAdmin) {
      fetchData();
    }
  }, [isSuperAdmin, isAdmin]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch module access with user details
      const { data: moduleData, error: moduleError } = await supabase
        .from("user_modules")
        .select(`
          *,
          profiles!user_id(email, full_name),
          granted_by_profile:profiles!granted_by(email, full_name)
        `);

      if (moduleError) throw moduleError;

      // Fetch all profiles for user selection
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name, tenant_id")
        .order("email");

      if (profileError) throw profileError;

      // Transform the data
      const transformedModuleData = moduleData?.map(item => ({
        ...item,
        user_email: item.profiles?.email || 'Unknown',
        user_name: item.profiles?.full_name || 'N/A',
        granted_by_email: item.granted_by_profile?.email || 'System',
      })) || [];

      setModuleAccess(transformedModuleData);
      setProfiles(profileData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load module data");
    } finally {
      setLoading(false);
    }
  };

  const grantModule = async () => {
    if (!selectedUser || !selectedModule) {
      toast.error("Please select a user and module");
      return;
    }

    try {
      const { error } = await supabase
        .from("user_modules")
        .insert({
          user_id: selectedUser,
          module: selectedModule,
          granted_by: user?.id,
          expires_at: expiresAt || null,
        });

      if (error) throw error;

      toast.success("Module access granted successfully");
      setDialogOpen(false);
      setSelectedUser('');
      setSelectedModule('email_management');
      setExpiresAt('');
      fetchData();
    } catch (error: any) {
      console.error("Error granting module:", error);
      if (error.code === '23505') {
        toast.error("User already has access to this module");
      } else {
        toast.error("Failed to grant module access");
      }
    }
  };

  const toggleModule = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("user_modules")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast.success(`Module access ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchData();
    } catch (error) {
      console.error("Error toggling module:", error);
      toast.error("Failed to update module access");
    }
  };

  const revokeModule = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this module access? This action cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("user_modules")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Module access revoked successfully");
      fetchData();
    } catch (error) {
      console.error("Error revoking module:", error);
      toast.error("Failed to revoke module access");
    }
  };

  if (!isSuperAdmin && !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md text-center">
          <CardContent className="p-6">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You need admin privileges to access module management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ImprovedNavigation />
      
      <main className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Module Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage user access to Email Management and Security modules
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Grant Module Access
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Grant Module Access</DialogTitle>
                <DialogDescription>
                  Grant a user access to a specific module
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="user-select">Select User</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.email} {profile.full_name && `(${profile.full_name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="module-select">Select Module</Label>
                  <Select value={selectedModule} onValueChange={(value: UserModule) => setSelectedModule(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(moduleInfo).map(([key, info]) => {
                        const Icon = info.icon;
                        return (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {info.name}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="expires-at">Expiry Date (Optional)</Label>
                  <Input
                    id="expires-at"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
                
                <Button onClick={grantModule} className="w-full">
                  Grant Access
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Module Overview Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {Object.entries(moduleInfo).map(([key, info]) => {
            const Icon = info.icon;
            const moduleUsers = moduleAccess.filter(m => m.module === key && m.is_active);
            
            return (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    {info.name}
                  </CardTitle>
                  <CardDescription>{info.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{moduleUsers.length}</p>
                      <p className="text-sm text-muted-foreground">Active Users</p>
                    </div>
                    <Badge className={info.color}>
                      {info.defaultEnabled ? 'Default' : 'Premium'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Module Access Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Module Access Overview
            </CardTitle>
            <CardDescription>
              View and manage all user module access permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading module access...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Granted By</TableHead>
                    <TableHead>Granted At</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {moduleAccess.map((access) => {
                    const info = moduleInfo[access.module];
                    const Icon = info.icon;
                    const isExpired = access.expires_at && new Date(access.expires_at) < new Date();
                    
                    return (
                      <TableRow key={access.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{access.user_email}</p>
                            {access.user_name !== 'N/A' && (
                              <p className="text-sm text-muted-foreground">{access.user_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {info.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            isExpired ? "destructive" : 
                            access.is_active ? "default" : "secondary"
                          }>
                            {isExpired ? "Expired" : access.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>{access.granted_by_email}</TableCell>
                        <TableCell>
                          {new Date(access.granted_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {access.expires_at ? new Date(access.expires_at).toLocaleDateString() : "Never"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={access.is_active}
                              onCheckedChange={() => toggleModule(access.id, access.is_active)}
                              disabled={isExpired}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => revokeModule(access.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}