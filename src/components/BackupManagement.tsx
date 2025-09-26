import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Download, Database, Calendar, FileText, AlertCircle } from "lucide-react";

export const BackupManagement = () => {
  const { user } = useAuth();
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);

  const createBackup = async () => {
    if (!user) return;

    setIsCreatingBackup(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('backup-system', {
        body: {}
      });

      if (error) {
        console.error('Backup error:', error);
        toast.error('Failed to create backup: ' + error.message);
        return;
      }

      if (data?.success) {
        toast.success(
          `Backup created successfully! ${data.backup_info.total_records} records backed up across ${data.backup_info.tables_backed_up} tables.`,
          {
            description: `File: ${data.backup_info.file_name}`
          }
        );
      } else {
        toast.error('Backup failed: ' + (data?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Backup exception:', err);
      toast.error('Failed to create backup');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const downloadBackups = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        toast.error('Profile not found');
        return;
      }

      // List backup files
      const { data: files, error } = await supabase.storage
        .from('backups')
        .list(profile.tenant_id, {
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        toast.error('Failed to list backup files: ' + error.message);
        return;
      }

      if (!files || files.length === 0) {
        toast.info('No backup files found');
        return;
      }

      // Get signed URL for the most recent backup
      const latestBackup = files[0];
      const { data: signedUrl, error: urlError } = await supabase.storage
        .from('backups')
        .createSignedUrl(`${profile.tenant_id}/${latestBackup.name}`, 300); // 5 minutes

      if (urlError || !signedUrl) {
        toast.error('Failed to create download URL');
        return;
      }

      // Create download link
      const link = document.createElement('a');
      link.href = signedUrl.signedUrl;
      link.download = latestBackup.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Downloading: ${latestBackup.name}`);
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download backup');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Backup Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Backup Actions */}
        <div className="flex gap-3">
          <Button
            onClick={createBackup}
            disabled={isCreatingBackup}
            className="flex items-center gap-2"
          >
            <Database className="h-4 w-4" />
            {isCreatingBackup ? 'Creating Backup...' : 'Create Backup'}
          </Button>
          
          <Button
            variant="outline"
            onClick={downloadBackups}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Latest
          </Button>
        </div>

        <Separator />

        {/* Backup Information */}
        <div className="space-y-3">
          <h3 className="font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            What's Included in Backups
          </h3>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Data</Badge>
              <span>All emails & classifications</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Config</Badge>
              <span>Categories & rules</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Security</Badge>
              <span>VIP lists & threat feeds</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Teams</Badge>
              <span>Meeting data & analytics</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Storage Information */}
        <div className="space-y-2">
          <h3 className="font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Backup Storage
          </h3>
          
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• Backups are stored securely in Supabase Storage</p>
            <p>• Files are organized by tenant and date</p>
            <p>• JSON format for easy restoration</p>
            <p>• Download requires authentication</p>
          </div>
        </div>

        <Separator />

        {/* Security Notice */}
        <div className="bg-muted/50 p-3 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-500">Security Notice</p>
              <p className="text-muted-foreground mt-1">
                Backup files contain sensitive data. Store downloaded files securely and delete them after use.
              </p>
            </div>
          </div>
        </div>

        {/* Automation Hint */}
        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900">
          <div className="text-sm">
            <p className="font-medium text-blue-700 dark:text-blue-400">Automation Available</p>
            <p className="text-blue-600 dark:text-blue-300 mt-1">
              Contact your system administrator to set up automated daily backups using cron jobs.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};