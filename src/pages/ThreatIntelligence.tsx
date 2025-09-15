import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRoles } from "@/hooks/useRoles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  User,
  LogOut,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface ThreatFeed {
  id: string;
  name: string;
  feed_type: string;
  feed_url?: string;
  api_endpoint?: string;
  api_key_required: boolean;
  api_key?: string;
  update_frequency_hours: number;
  is_active: boolean;
  is_preconfigured: boolean;
  description?: string;
  last_updated_at?: string;
  total_entries: number;
  success_rate: number;
  created_at: string;
}

const FEED_TYPES = [
  { value: 'domain_blocklist', label: 'Domain Blocklist' },
  { value: 'url_blocklist', label: 'URL Blocklist' },
  { value: 'ip_blocklist', label: 'IP Blocklist' },
  { value: 'hash_blocklist', label: 'Hash Blocklist' },
  { value: 'reputation_check', label: 'Reputation Check' },
  { value: 'phishing_check', label: 'Phishing Check' }
];

import { ImprovedNavigation } from "@/components/ImprovedNavigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function ThreatIntelligence() {
  const { user } = useAuth();
  const { isSuperAdmin } = useRoles();
  const [feeds, setFeeds] = useState<ThreatFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFeed, setEditingFeed] = useState<ThreatFeed | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const [feedForm, setFeedForm] = useState({
    name: '',
    feed_type: 'domain_blocklist',
    feed_url: '',
    api_endpoint: '',
    api_key_required: false,
    api_key: '',
    update_frequency_hours: 24,
    description: ''
  });

  useEffect(() => {
    if (!user) return;
    fetchFeeds();
    checkFeedHealth(); // Check health on load
    
    // Set up interval to check health every 5 minutes
    const healthInterval = setInterval(checkFeedHealth, 5 * 60 * 1000);
    
    return () => clearInterval(healthInterval);
  }, [user]);

  const fetchFeeds = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('threat_intelligence_feeds')
        .select('*')
        .order('is_preconfigured', { ascending: false })
        .order('name');

      if (error) throw error;
      setFeeds(data || []);
    } catch (error) {
      console.error('Error fetching threat feeds:', error);
      toast.error('Failed to load threat intelligence feeds');
    } finally {
      setLoading(false);
    }
  };

  const checkFeedHealth = async () => {
    try {
      setHealthLoading(true);
      const supabaseUrl = 'https://ceasktzguzibehknbgsx.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlYXNrdHpndXppYmVoa25iZ3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjg2OTAsImV4cCI6MjA3MDcwNDY5MH0.wUUytPNjVDFc0uGlhxnSmp0fw_VIdGPK2kHGft9lfso';
      
      const response = await fetch(`${supabaseUrl}/functions/v1/feed-health-monitor`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        setHealthStatus(result);
        
        // Show alert if many feeds are failing
        if (result.summary && result.summary.total_feeds > 0) {
          const healthyPercentage = (result.summary.healthy_feeds / result.summary.total_feeds) * 100;
          
          if (healthyPercentage < 50) {
            toast.error(`⚠️ Critical: Only ${result.summary.healthy_feeds}/${result.summary.total_feeds} threat intelligence feeds are healthy!`);
          } else if (healthyPercentage < 75) {
            toast.error(`⚠️ Warning: ${result.summary.healthy_feeds}/${result.summary.total_feeds} threat intelligence feeds are healthy.`);
          }
        }
      }
    } catch (error) {
      console.error('Error checking feed health:', error);
    } finally {
      setHealthLoading(false);
    }
  };

  const resetForm = () => {
    setFeedForm({
      name: '',
      feed_type: 'domain_blocklist',
      feed_url: '',
      api_endpoint: '',
      api_key_required: false,
      api_key: '',
      update_frequency_hours: 24,
      description: ''
    });
    setEditingFeed(null);
  };

  const handleAddFeed = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEditFeed = (feed: ThreatFeed) => {
    if (feed.is_preconfigured && !isSuperAdmin) {
      toast.error('Only super admins can edit pre-configured feeds');
      return;
    }
    
    setFeedForm({
      name: feed.name,
      feed_type: feed.feed_type,
      feed_url: feed.feed_url || '',
      api_endpoint: feed.api_endpoint || '',
      api_key_required: feed.api_key_required,
      api_key: feed.api_key || '',
      update_frequency_hours: feed.update_frequency_hours,
      description: feed.description || ''
    });
    setEditingFeed(feed);
    setIsDialogOpen(true);
  };

  const handleSaveFeed = async () => {
    try {
      setSaving(true);

      // For preconfigured feeds, we don't include tenant_id as they are global
      const feedData = editingFeed?.is_preconfigured 
        ? { ...feedForm }
        : {
            ...feedForm,
            tenant_id: (await supabase.from('profiles').select('tenant_id').eq('id', user!.id).single()).data?.tenant_id
          };

      let error;
      if (editingFeed) {
        ({ error } = await supabase
          .from('threat_intelligence_feeds')
          .update(feedData)
          .eq('id', editingFeed.id));
      } else {
        ({ error } = await supabase
          .from('threat_intelligence_feeds')
          .insert([{
            ...feedData,
            is_preconfigured: false, // New feeds are not preconfigured
            tenant_id: (await supabase.from('profiles').select('tenant_id').eq('id', user!.id).single()).data?.tenant_id
          }]));
      }

      if (error) throw error;

      toast.success(editingFeed ? 'Feed updated successfully' : 'Feed added successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchFeeds();
    } catch (error) {
      console.error('Error saving feed:', error);
      toast.error('Failed to save feed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFeed = async (feedId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('threat_intelligence_feeds')
        .update({ is_active: isActive })
        .eq('id', feedId);

      if (error) throw error;

      toast.success(isActive ? 'Feed enabled' : 'Feed disabled');
      fetchFeeds();
    } catch (error) {
      console.error('Error toggling feed:', error);
      toast.error('Failed to update feed status');
    }
  };

  const handleRefreshFeeds = async () => {
    try {
      setSaving(true);
      console.log('Triggering feed health monitor...');
      
      const supabaseUrl = 'https://ceasktzguzibehknbgsx.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlYXNrdHpndXppYmVoa25iZ3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxMjg2OTAsImV4cCI6MjA3MDcwNDY5MH0.wUUytPNjVDFc0uGlhxnSmp0fw_VIdGPK2kHGft9lfso';
      
      const response = await fetch(`${supabaseUrl}/functions/v1/feed-health-monitor`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Feed health monitor result:', result);
        setHealthStatus(result);
        
        toast.success(`Feed update completed! ${result.summary?.healthy_feeds || 0}/${result.summary?.total_feeds || 0} feeds healthy`);
        
        // Refresh the feeds list to show updated data
        await fetchFeeds();
      } else {
        const error = await response.text();
        console.error('Feed health monitor error:', error);
        toast.error('Failed to update feeds. Check console for details.');
      }
    } catch (error) {
      console.error('Error triggering feed health monitor:', error);
      toast.error('Failed to trigger feed update');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFeed = async (feedId: string) => {
    try {
      const { error } = await supabase
        .from('threat_intelligence_feeds')
        .delete()
        .eq('id', feedId);

      if (error) throw error;

      toast.success('Feed deleted successfully');
      fetchFeeds();
    } catch (error) {
      console.error('Error deleting feed:', error);
      toast.error('Failed to delete feed');
    }
  };

  const getFeedTypeLabel = (type: string) => {
    return FEED_TYPES.find(t => t.value === type)?.label || type;
  };

  const getStatusBadge = (feed: ThreatFeed) => {
    if (!feed.is_active) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    
    if (feed.success_rate < 90) {
      return <Badge variant="destructive">Issues</Badge>;
    }
    
    return <Badge variant="default" className="bg-green-500">Active</Badge>;
  };

  const formatLastUpdate = (lastUpdate?: string) => {
    if (!lastUpdate) return 'Never';
    return new Date(lastUpdate).toLocaleString();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Required</CardTitle>
            <CardDescription>Please sign in to manage threat intelligence feeds.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ImprovedNavigation />
      <main className="container mx-auto px-4 py-8">
        <Breadcrumbs />
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Shield className="h-8 w-8" />
                Threat Intelligence Feeds
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage threat intelligence feeds to enhance email security with real-time threat data
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefreshFeeds}
                disabled={saving}
                className="gap-2"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Update All Feeds
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.location.href = '/threat-monitor'}>
                <RefreshCw className="mr-2 h-4 w-4" />
                View Threat Monitor
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleAddFeed} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Custom Feed
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingFeed ? 'Edit Threat Feed' : 'Add Custom Threat Feed'}
                    </DialogTitle>
                    <DialogDescription>
                      Configure a custom threat intelligence feed to enhance email security
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="feed-name">Feed Name</Label>
                        <Input
                          id="feed-name"
                          value={feedForm.name}
                          onChange={(e) => setFeedForm({...feedForm, name: e.target.value})}
                          placeholder="e.g., Custom Malware Domains"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="feed-type">Feed Type</Label>
                        <Select
                          value={feedForm.feed_type}
                          onValueChange={(value) => setFeedForm({...feedForm, feed_type: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FEED_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="feed-url">Feed URL</Label>
                      <Input
                        id="feed-url"
                        value={feedForm.feed_url}
                        onChange={(e) => setFeedForm({...feedForm, feed_url: e.target.value})}
                        placeholder="https://example.com/threat-feed.txt"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="api-endpoint">API Endpoint (optional)</Label>
                      <Input
                        id="api-endpoint"
                        value={feedForm.api_endpoint}
                        onChange={(e) => setFeedForm({...feedForm, api_endpoint: e.target.value})}
                        placeholder="https://api.example.com/threats"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="api-key-required"
                        checked={feedForm.api_key_required}
                        onCheckedChange={(checked) => setFeedForm({...feedForm, api_key_required: checked})}
                      />
                      <Label htmlFor="api-key-required">Requires API Key</Label>
                    </div>

                    {feedForm.api_key_required && (
                      <div className="space-y-2">
                        <Label htmlFor="api-key">API Key</Label>
                        <Input
                          id="api-key"
                          type="password"
                          value={feedForm.api_key}
                          onChange={(e) => setFeedForm({...feedForm, api_key: e.target.value})}
                          placeholder="Enter API key"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="update-frequency">Update Frequency (hours)</Label>
                      <Input
                        id="update-frequency"
                        type="number"
                        min="1"
                        max="168"
                        value={feedForm.update_frequency_hours}
                        onChange={(e) => setFeedForm({...feedForm, update_frequency_hours: parseInt(e.target.value) || 24})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={feedForm.description}
                        onChange={(e) => setFeedForm({...feedForm, description: e.target.value})}
                        placeholder="Describe what this threat feed provides..."
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setIsDialogOpen(false)}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSaveFeed} disabled={saving}>
                        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        {editingFeed ? 'Update Feed' : 'Add Feed'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Health Status Dashboard */}
          {healthStatus && (
            <Card className={`border ${healthStatus.summary && healthStatus.summary.healthy_feeds < healthStatus.summary.total_feeds * 0.5 ? 'border-red-500 bg-red-50' : healthStatus.summary && healthStatus.summary.healthy_feeds < healthStatus.summary.total_feeds * 0.75 ? 'border-yellow-500 bg-yellow-50' : 'border-green-500 bg-green-50'}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {healthStatus.summary && healthStatus.summary.healthy_feeds < healthStatus.summary.total_feeds * 0.5 ? (
                    <>
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <span className="text-red-700">Critical: Threat Intelligence Feed Issues</span>
                    </>
                  ) : healthStatus.summary && healthStatus.summary.healthy_feeds < healthStatus.summary.total_feeds * 0.75 ? (
                    <>
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      <span className="text-yellow-700">Warning: Some Feed Issues Detected</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-green-700">Threat Intelligence Feeds Healthy</span>
                    </>
                  )}
                  {healthLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                </CardTitle>
                <CardDescription>
                  Last checked: {healthStatus.timestamp ? new Date(healthStatus.timestamp).toLocaleString() : 'Never'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {healthStatus.summary?.healthy_feeds || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Healthy Feeds</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {healthStatus.summary ? (healthStatus.summary.total_feeds - healthStatus.summary.healthy_feeds) : 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Failed Feeds</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {healthStatus.summary?.total_feeds || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Feeds</div>
                  </div>
                </div>
                
                {healthStatus.failed_feeds && healthStatus.failed_feeds.length > 0 && (
                  <div className="mt-4 p-4 bg-red-100 rounded-lg">
                    <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Failed Feeds ({healthStatus.failed_feeds.length})
                    </h4>
                    <div className="space-y-2">
                      {healthStatus.failed_feeds.map((failedFeed: any, index: number) => (
                        <div key={index} className="text-sm text-red-700 flex items-center justify-between">
                          <span className="font-medium">{failedFeed.name}</span>
                          <span className="text-xs text-red-600">
                            {failedFeed.error ? (
                              failedFeed.error.includes('timeout') ? 'Timeout' :
                              failedFeed.error.includes('DNS') ? 'DNS Error' :
                              failedFeed.error.includes('connect') ? 'Connection Failed' :
                              'Error'
                            ) : 'No data'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="mt-4 flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={checkFeedHealth}
                    disabled={healthLoading}
                    className="gap-2"
                  >
                    {healthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Check Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Feeds</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{feeds.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Feeds</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {feeds.filter(f => f.is_active).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pre-configured</CardTitle>
                <AlertTriangle className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {feeds.filter(f => f.is_preconfigured).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Custom Feeds</CardTitle>
                <Plus className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {feeds.filter(f => !f.is_preconfigured).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Feeds Table */}
          <Card>
            <CardHeader>
              <CardTitle>Threat Intelligence Feeds</CardTitle>
              <CardDescription>
                Manage and monitor your threat intelligence sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>Entries</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feeds.map((feed) => (
                      <TableRow key={feed.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{feed.name}</span>
                            {feed.is_preconfigured && (
                              <Badge variant="outline" className="w-fit mt-1">
                                Pre-configured
                              </Badge>
                            )}
                            {feed.description && (
                              <span className="text-xs text-muted-foreground mt-1">
                                {feed.description}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {getFeedTypeLabel(feed.feed_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(feed)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${feed.success_rate >= 90 ? 'text-green-600' : 'text-red-600'}`}>
                              {feed.success_rate.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono">
                            {feed.total_entries.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatLastUpdate(feed.last_updated_at)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={feed.is_active}
                              onCheckedChange={(checked) => handleToggleFeed(feed.id, checked)}
                            />
                            {feed.feed_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(feed.feed_url, '_blank')}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditFeed(feed)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            {!feed.is_preconfigured && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteFeed(feed.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Information Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-blue-500" />
                About Threat Intelligence Feeds
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Threat intelligence feeds provide real-time data about malicious domains, URLs, IP addresses, and other indicators of compromise (IoCs) to enhance email security.
              </p>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-2">Pre-configured Feeds</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Malware Domain List - Community malware domains</li>
                    <li>• PhishTank - Verified phishing URLs</li>
                    <li>• URLhaus - Recent malware URLs</li>
                    <li>• Feodo Tracker - Botnet C&C servers</li>
                    <li>• Spamhaus DROP - Malicious netblocks</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Feed Types</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• <strong>Domain Blocklist:</strong> Malicious domains</li>
                    <li>• <strong>URL Blocklist:</strong> Specific malicious URLs</li>
                    <li>• <strong>IP Blocklist:</strong> Compromised IP addresses</li>
                    <li>• <strong>Reputation Check:</strong> Domain/IP reputation</li>
                    <li>• <strong>Phishing Check:</strong> Anti-phishing databases</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}