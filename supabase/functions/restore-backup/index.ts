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

    // Check if user has super admin role
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
    if (!isSuperAdmin) {
      return new Response('Forbidden - Super Admin required', { status: 403, headers: corsHeaders });
    }

    const { backup_file_name } = await req.json();

    if (!backup_file_name) {
      return new Response('backup_file_name is required', { status: 400, headers: corsHeaders });
    }

    console.log('Starting restore from:', backup_file_name);

    // Get user's profile and tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response('Profile not found', { status: 404, headers: corsHeaders });
    }

    // Download backup file
    const { data: backupFile, error: downloadError } = await supabase.storage
      .from('backups')
      .download(`${profile.tenant_id}/${backup_file_name}`);

    if (downloadError || !backupFile) {
      return new Response(`Failed to download backup: ${downloadError?.message}`, { 
        status: 404, headers: corsHeaders 
      });
    }

    // Parse backup data
    const backupContent = await backupFile.text();
    const backupData = JSON.parse(backupContent);

    console.log('Backup file loaded, starting restoration...');

    const results = {
      restored_tables: [] as string[],
      skipped_tables: [] as string[],
      errors: [] as string[],
      total_records_restored: 0
    };

    // Tables to restore in dependency order
    const restoreOrder = [
      'profiles',
      'mailboxes',
      'email_categories', 
      'emails',
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
      'threat_intelligence_results',
      'user_roles',
      'user_modules'
    ];

    // Restore each table
    for (const tableName of restoreOrder) {
      const tableData = backupData.tables[tableName];
      
      if (!tableData || !tableData.data || tableData.data.length === 0) {
        console.log(`Skipping ${tableName} - no data`);
        results.skipped_tables.push(tableName);
        continue;
      }

      try {
        console.log(`Restoring ${tableName}: ${tableData.data.length} records`);

        // Delete existing data for this tenant (except profiles and preconfigured feeds)
        if (tableName !== 'profiles' && tableName !== 'threat_intelligence_feeds') {
          await supabase.from(tableName).delete().eq('tenant_id', profile.tenant_id);
        }

        // Insert data in batches to avoid memory issues
        const batchSize = 100;
        let restored = 0;

        for (let i = 0; i < tableData.data.length; i += batchSize) {
          const batch = tableData.data.slice(i, i + batchSize);
          
          const { error: insertError } = await supabase
            .from(tableName)
            .insert(batch);

          if (insertError) {
            console.error(`Error inserting batch for ${tableName}:`, insertError);
            results.errors.push(`${tableName}: ${insertError.message}`);
            break;
          }

          restored += batch.length;
        }

        results.restored_tables.push(tableName);
        results.total_records_restored += restored;
        console.log(`✓ ${tableName}: ${restored} records restored`);

      } catch (err: any) {
        console.error(`Exception restoring ${tableName}:`, err);
        results.errors.push(`${tableName}: ${err.message}`);
      }
    }

    console.log('Restore completed');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Backup restored successfully',
        results: results,
        backup_info: backupData.backup_info
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Restore function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Restore failed',
        message: error.message 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});