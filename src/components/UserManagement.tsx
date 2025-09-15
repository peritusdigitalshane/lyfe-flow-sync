import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Shield, UserCheck, Crown, CheckCircle, AlertCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database['public']['Enums']['app_role'];

interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  account_status: string;
  roles: string[];
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch users with their account status
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at, account_status")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for each user
      const userIds = profiles?.map(p => p.id) || [];
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      if (rolesError) throw rolesError;

      // Combine users with their roles
      const usersWithRoles = profiles?.map(profile => ({
        ...profile,
        roles: userRoles?.filter(role => role.user_id === profile.id).map(role => role.role) || []
      })) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: AppRole, action: 'add' | 'remove') => {
    try {
      setUpdatingUser(userId);

      if (action === 'add') {
        const { error } = await supabase
          .from("user_roles")
          .insert({
            user_id: userId,
            role: newRole,
            created_by: userId
          });

        if (error) throw error;
        toast.success(`Role ${newRole} added successfully`);
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", newRole);

        if (error) throw error;
        toast.success(`Role ${newRole} removed successfully`);
      }

      // Refresh users list
      await fetchUsers();
    } catch (error) {
      console.error("Error updating user role:", error);
      toast.error("Failed to update user role");
    } finally {
      setUpdatingUser(null);
    }
  };

  const activateUser = async (userId: string, email: string) => {
    try {
      setUpdatingUser(userId);

      // Use the database function directly - this works for both Stripe and manual activation
      const { error } = await supabase.rpc('activate_user_account', {
        user_email: email
      });

      if (error) throw error;

      toast.success("User activated successfully");
      await fetchUsers();
    } catch (error) {
      console.error("Error activating user:", error);
      toast.error("Failed to activate user: " + (error as Error).message);
    } finally {
      setUpdatingUser(null);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Crown className="h-3 w-3" />;
      case 'admin':
        return <Shield className="h-3 w-3" />;
      case 'moderator':
        return <UserCheck className="h-3 w-3" />;
      case 'user':
        return <Users className="h-3 w-3" />;
      default:
        return <Users className="h-3 w-3" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'moderator':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'user':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-grey-100 text-grey-800 dark:bg-grey-900 dark:text-grey-200';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          User Management
        </CardTitle>
        <CardDescription>
          Manage user accounts and their role assignments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">
                      {user.full_name || 'No name'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={user.account_status === 'active' ? 'default' : 'secondary'}
                      className={`text-xs ${
                        user.account_status === 'active' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                      }`}
                    >
                      {user.account_status === 'active' ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      )}
                      {user.account_status === 'active' ? 'Active' : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <Badge
                            key={role}
                            variant="secondary"
                            className={`text-xs ${getRoleColor(role)}`}
                          >
                            {getRoleIcon(role)}
                            <span className="ml-1 capitalize">
                              {role.replace('_', ' ')}
                            </span>
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          No roles
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 flex-wrap">
                      {user.account_status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => activateUser(user.id, user.email)}
                          disabled={updatingUser === user.id}
                          className="h-8 text-xs"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Activate
                        </Button>
                      )}
                      
                      <Select
                        onValueChange={(role) => updateUserRole(user.id, role as AppRole, 'add')}
                        disabled={updatingUser === user.id}
                      >
                        <SelectTrigger className="w-32 h-8">
                          <SelectValue placeholder="Add role" />
                        </SelectTrigger>
                        <SelectContent>
                          {['user', 'moderator', 'admin', 'super_admin'].filter(
                            role => !user.roles.includes(role)
                          ).map((role) => (
                            <SelectItem key={role} value={role}>
                              <div className="flex items-center gap-2">
                                {getRoleIcon(role)}
                                <span className="capitalize">
                                  {role.replace('_', ' ')}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {user.roles.length > 0 && (
                        <Select
                          onValueChange={(role) => updateUserRole(user.id, role as AppRole, 'remove')}
                          disabled={updatingUser === user.id}
                        >
                          <SelectTrigger className="w-36 h-8">
                            <SelectValue placeholder="Remove role" />
                          </SelectTrigger>
                          <SelectContent>
                            {user.roles.map((role) => (
                              <SelectItem key={role} value={role}>
                                <div className="flex items-center gap-2">
                                  {getRoleIcon(role)}
                                  <span className="capitalize">
                                    {role.replace('_', ' ')}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No users found
          </div>
        )}
      </CardContent>
    </Card>
  );
}