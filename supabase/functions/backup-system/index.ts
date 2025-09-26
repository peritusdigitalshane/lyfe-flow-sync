import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    console.log('Starting backup for user:', user.id);

    // Get user's profile and tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id, full_name')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response('Profile not found', { status: 404, headers: corsHeaders });
    }

    const { tenant_id } = profile;
    const timestamp = new Date().toISOString();
    const backupData: any = {
      backup_info: {
        created_at: timestamp,
        tenant_id: tenant_id,
        user_id: user.id,
        version: '1.0'
      },
      tables: {}
    };

    console.log('Exporting data for tenant:', tenant_id);

    // Tables to backup with tenant filtering
    const tenantTables = [
      'profiles',
      'mailboxes', 
      'emails',
      'email_categories',
      'email_classifications',
      'email_classification_rules',
      'email_polling_status',
      'vip_email_addresses',
      'workflow_rules',
      'workflow_executions',
      'audit_logs',
      'mailbox_configs',
      'teams_settings',
      'meeting_summaries',
      'meeting_action_items',
      'teams_analytics',
      'threat_intelligence_feeds',
      'threat_intelligence_results'
    ];

    // Export each table
    for (const tableName of tenantTables) {
      try {
        console.log(`Backing up table: ${tableName}`);
        
        let query = supabase.from(tableName).select('*');
        
        // Apply tenant filtering based on table structure
        if (tableName === 'profiles') {
          query = query.eq('tenant_id', tenant_id);
        } else if (tableName === 'threat_intelligence_feeds') {
          // Include both tenant-specific and preconfigured feeds
          query = query.or(`tenant_id.eq.${tenant_id},is_preconfigured.eq.true`);
        } else {
          // Most tables have tenant_id
          query = query.eq('tenant_id', tenant_id);
        }

        const { data, error } = await query;
        
        if (error) {
          console.error(`Error backing up ${tableName}:`, error);
          backupData.tables[tableName] = { error: error.message, count: 0 };
        } else {
          backupData.tables[tableName] = { 
            data: data || [], 
            count: data?.length || 0 
          };
          console.log(`${tableName}: ${data?.length || 0} records`);
        }
      } catch (err) {
        console.error(`Exception backing up ${tableName}:`, err);
        backupData.tables[tableName] = { 
          error: err.message, 
          count: 0 
        };
      }
    }

    // Also backup user roles and modules
    try {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id);

      const { data: userModules } = await supabase
        .from('user_modules')
        .select('*')
        .eq('user_id', user.id);

      backupData.tables.user_roles = { data: userRoles || [], count: userRoles?.length || 0 };
      backupData.tables.user_modules = { data: userModules || [], count: userModules?.length || 0 };
    } catch (err) {
      console.error('Error backing up user roles/modules:', err);
    }

    // Calculate total records
    const totalRecords = Object.values(backupData.tables).reduce((sum: number, table: any) => {
      return sum + (table.count || 0);
    }, 0);

    backupData.backup_info.total_records = totalRecords;
    backupData.backup_info.tables_count = Object.keys(backupData.tables).length;

    // Create backup file content
    const backupContent = JSON.stringify(backupData, null, 2);
    const fileName = `${tenant_id}/backup-${timestamp.split('T')[0]}-${Date.now()}.json`;

    console.log('Uploading backup to storage...');

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('backups')
      .upload(fileName, backupContent, {
        contentType: 'application/json',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to upload backup',
          details: uploadError.message 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Backup completed successfully');

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true,
        backup_info: {
          file_name: fileName,
          total_records: totalRecords,
          tables_backed_up: Object.keys(backupData.tables).length,
          created_at: timestamp,
          file_size: new Blob([backupContent]).size
        },
        tables_summary: Object.keys(backupData.tables).reduce((summary: any, tableName) => {
          summary[tableName] = backupData.tables[tableName].count;
          return summary;
        }, {})
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Backup function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Backup failed',
        message: error.message 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});