import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Shield, UserCheck, Crown, Mail, Search, AlertCircle, Plus, Trash2, X, User, LogOut, ArrowLeft } from "lucide-react";
import { useRoles } from "@/hooks/useRoles";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database['public']['Enums']['app_role'];

interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  tenant_id: string;
  roles: AppRole[];
  mailbox_count: number;
  last_sign_in?: string;
}

interface UserStats {
  total_users: number;
  super_admins: number;
  admins: number;
  moderators: number;
  regular_users: number;
  total_mailboxes: number;
}

interface CreateUserForm {
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
}

export default function UserManagement() {
  const { user, signOut } = useAuth();
  const { isSuperAdmin, isAdmin } = useRoles();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserForm, setCreateUserForm] = useState<CreateUserForm>({
    email: "",
    password: "",
    fullName: "",
    role: "user"
  });

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch users - Super Admins see all, Admins see only their tenant
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, created_at, tenant_id")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for each user
      const userIds = profiles?.map(p => p.id) || [];
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      if (rolesError) throw rolesError;

      // Fetch mailbox counts for each user
      const { data: mailboxCounts, error: mailboxError } = await supabase
        .from("mailboxes")
        .select("user_id")
        .in("user_id", userIds);

      if (mailboxError) throw mailboxError;

      // Get last sign in data from auth.users (if accessible)
      const usersWithDetails = profiles?.map(profile => {
        const roles = userRoles?.filter(role => role.user_id === profile.id).map(role => role.role) || [];
        const mailbox_count = mailboxCounts?.filter(mailbox => mailbox.user_id === profile.id).length || 0;
        
        return {
          ...profile,
          roles: roles as AppRole[],
          mailbox_count
        };
      }) || [];

      setUsers(usersWithDetails);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Get user counts by role
      const { data: roleStats, error: roleError } = await supabase
        .from("user_roles")
        .select("role");

      if (roleError) throw roleError;

      // Get total users
      const { count: totalUsers, error: userCountError } = await supabase
        .from("profiles")
        .select("*", { count: 'exact', head: true });

      if (userCountError) throw userCountError;

      // Get total mailboxes
      const { count: totalMailboxes, error: mailboxCountError } = await supabase
        .from("mailboxes")
        .select("*", { count: 'exact', head: true });

      if (mailboxCountError) throw mailboxCountError;

      const super_admins = roleStats?.filter(r => r.role === 'super_admin').length || 0;
      const admins = roleStats?.filter(r => r.role === 'admin').length || 0;
      const moderators = roleStats?.filter(r => r.role === 'moderator').length || 0;
      const regular_users = (totalUsers || 0) - super_admins - admins - moderators;

      setStats({
        total_users: totalUsers || 0,
        super_admins,
        admins,
        moderators,
        regular_users,
        total_mailboxes: totalMailboxes || 0
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const filterUsers = () => {
    let filtered = users;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by role
    if (roleFilter !== "all") {
      filtered = filtered.filter(user => user.roles.includes(roleFilter as AppRole));
    }

    setFilteredUsers(filtered);
  };

  const updateUserRole = async (userId: string, newRole: AppRole, action: 'add' | 'remove') => {
    try {
      setUpdatingUser(userId);

      // Get current user to check permissions
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (action === 'add') {
        const { error } = await supabase
          .from("user_roles")
          .insert({
            user_id: userId,
            role: newRole,
            created_by: currentUser?.id
          });

        if (error) throw error;
        toast.success(`Role ${newRole.replace('_', ' ')} added successfully`);
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", newRole);

        if (error) throw error;
        toast.success(`Role ${newRole.replace('_', ' ')} removed successfully`);
      }

      // Refresh users list and stats
      await Promise.all([fetchUsers(), fetchStats()]);
    } catch (error) {
      console.error("Error updating user role:", error);
      toast.error("Failed to update user role");
    } finally {
      setUpdatingUser(null);
    }
  };

  const createUser = async () => {
    try {
      setCreatingUser(true);

      // Validate form
      if (!createUserForm.email || !createUserForm.password) {
        toast.error("Email and password are required");
        return;
      }

      // Create user via edge function
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: createUserForm.email,
          password: createUserForm.password,
          fullName: createUserForm.fullName,
          role: createUserForm.role
        }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.warning) {
        toast.warning(data.warning);
      } else {
        toast.success(`User ${createUserForm.email} created successfully`);
      }

      // Reset form and close dialog
      setCreateUserForm({
        email: "",
        password: "",
        fullName: "",
        role: "user"
      });
      setCreateUserDialogOpen(false);

      // Refresh users list and stats
      await Promise.all([fetchUsers(), fetchStats()]);
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error("Failed to create user: " + (error.message || "Unknown error"));
    } finally {
      setCreatingUser(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCreateUserForm(prev => ({ ...prev, password }));
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

  const StatCard = ({ title, value, description, icon }: { 
    title: string; 
    value: number; 
    description: string; 
    icon: React.ReactNode;
  }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div className="text-primary">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/auth";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-primary rounded-lg shadow-glow-primary"></div>
                  <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                    Lyfe Email Management
                  </h1>
                </div>
                <nav className="hidden md:flex items-center space-x-6">
                  <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
                    Dashboard
                  </Link>
                  <Link to="/workflows" className="text-muted-foreground hover:text-foreground">
                    Workflows
                  </Link>
                  <Link to="/workflow-rules" className="text-muted-foreground hover:text-foreground">
                    Rules
                  </Link>
                  <Link to="/settings" className="text-muted-foreground hover:text-foreground">
                    Settings
                  </Link>
                  <Link to="/admin/users" className="text-foreground font-medium">
                    User Management
                  </Link>
                </nav>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Welcome, {user?.email}</span>
                </div>
                <Button onClick={handleSignOut} variant="ghost" size="sm" className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </header>
        
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-primary rounded-lg shadow-glow-primary"></div>
                <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Lyfe Email Management
                </h1>
              </div>
              <nav className="hidden md:flex items-center space-x-6">
                <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
                  Dashboard
                </Link>
                <Link to="/workflows" className="text-muted-foreground hover:text-foreground">
                  Workflows
                </Link>
                <Link to="/workflow-rules" className="text-muted-foreground hover:text-foreground">
                  Rules
                </Link>
                <Link to="/settings" className="text-muted-foreground hover:text-foreground">
                  Settings
                </Link>
                <Link to="/admin/users" className="text-foreground font-medium">
                  User Management
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Welcome, {user?.email}</span>
              </div>
              <Button onClick={handleSignOut} variant="ghost" size="sm" className="gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts, roles, and mailbox assignments
          </p>
        </div>
        <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Create a new user account with email and password. The user will be automatically activated.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={createUserForm.email}
                  onChange={(e) => setCreateUserForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={createUserForm.fullName}
                  onChange={(e) => setCreateUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password *</Label>
                <div className="flex gap-2">
                  <Input
                    id="password"
                    type="text"
                    placeholder="Enter password"
                    value={createUserForm.password}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, password: e.target.value }))}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={generatePassword}
                    disabled={creatingUser}
                  >
                    Generate
                  </Button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Initial Role</Label>
                <Select
                  value={createUserForm.role}
                  onValueChange={(value: AppRole) => setCreateUserForm(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        User
                      </div>
                    </SelectItem>
                    <SelectItem value="moderator">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Moderator
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Admin
                      </div>
                    </SelectItem>
                    <SelectItem value="super_admin">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4" />
                        Super Admin
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setCreateUserDialogOpen(false)}
                disabled={creatingUser}
              >
                Cancel
              </Button>
              <Button 
                onClick={createUser}
                disabled={creatingUser || !createUserForm.email || !createUserForm.password}
              >
                {creatingUser ? "Creating..." : "Create User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total Users"
            value={stats.total_users}
            description="All registered users"
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            title="Super Admins"
            value={stats.super_admins}
            description="Full system access"
            icon={<Crown className="h-4 w-4" />}
          />
          <StatCard
            title="Administrators"
            value={stats.admins}
            description="Admin privileges"
            icon={<Shield className="h-4 w-4" />}
          />
          <StatCard
            title="Moderators"
            value={stats.moderators}
            description="Moderation rights"
            icon={<UserCheck className="h-4 w-4" />}
          />
          <StatCard
            title="Total Mailboxes"
            value={stats.total_mailboxes}
            description="Connected accounts"
            icon={<Mail className="h-4 w-4" />}
          />
        </div>
      )}

      {/* User Management Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Directory
          </CardTitle>
          <CardDescription>
            View and manage all user accounts in the system
          </CardDescription>
          
          {/* Filters */}
          <div className="flex gap-4 mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Mailboxes</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">
                        {user.full_name || 'No name'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: {user.id.slice(0, 8)}...
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {user.email}
                      </div>
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
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{user.mailbox_count}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Select
                          onValueChange={(role) => updateUserRole(user.id, role as AppRole, 'add')}
                          disabled={updatingUser === user.id}
                        >
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue placeholder="Add role" />
                          </SelectTrigger>
                          <SelectContent>
                            {(['user', 'moderator', 'admin', 'super_admin'] as AppRole[]).filter(
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

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedUser(user)}
                            >
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>User Details</DialogTitle>
                              <DialogDescription>
                                Complete information for {selectedUser?.email}
                              </DialogDescription>
                            </DialogHeader>
                            {selectedUser && (
                              <div className="space-y-4">
                                <div>
                                  <label className="text-sm font-medium">Full Name</label>
                                  <p className="text-sm text-muted-foreground">
                                    {selectedUser.full_name || 'Not provided'}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Email</label>
                                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">User ID</label>
                                  <p className="text-sm text-muted-foreground font-mono">{selectedUser.id}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Tenant ID</label>
                                  <p className="text-sm text-muted-foreground font-mono">{selectedUser.tenant_id}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Account Created</label>
                                  <p className="text-sm text-muted-foreground">
                                    {new Date(selectedUser.created_at).toLocaleString()}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Connected Mailboxes</label>
                                  <p className="text-sm text-muted-foreground">
                                    {selectedUser.mailbox_count} mailbox{selectedUser.mailbox_count !== 1 ? 'es' : ''}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Current Roles</label>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {selectedUser.roles.map((role) => (
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
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm || roleFilter !== "all" ? "No users match the current filters" : "No users found"}
            </div>
          )}
        </CardContent>
      </Card>

        {/* Security Notice */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Security Notice:</strong> Only Super Administrators can access this user management portal. 
            Role changes are logged for audit purposes. Exercise caution when assigning Super Admin roles.
          </AlertDescription>
        </Alert>
      </main>
    </div>
  );
}