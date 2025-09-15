import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MailboxFolder {
  id: string;
  displayName: string;
  parentFolderId?: string;
  wellKnownName?: string;
}

interface FolderResponse {
  success: boolean;
  folders?: MailboxFolder[];
  error?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { mailbox_id } = await req.json();

    if (!mailbox_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Mailbox ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📁 [GET-FOLDERS] Fetching folders for mailbox ${mailbox_id}`);

    // Get the mailbox and its Microsoft Graph token
    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('microsoft_graph_token, email_address')
      .eq('id', mailbox_id)
      .single();

    if (mailboxError || !mailbox) {
      console.error('❌ [GET-FOLDERS] Mailbox not found:', mailboxError);
      return new Response(
        JSON.stringify({ success: false, error: 'Mailbox not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!mailbox.microsoft_graph_token) {
      console.error('❌ [GET-FOLDERS] No Microsoft Graph token found for mailbox');
      return new Response(
        JSON.stringify({ success: false, error: 'Mailbox not connected to Microsoft 365' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse and validate the Microsoft Graph token
    let tokenData;
    try {
      tokenData = JSON.parse(mailbox.microsoft_graph_token);
    } catch (error) {
      console.error('❌ [GET-FOLDERS] Invalid Microsoft Graph token format:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token format' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if token is expired and refresh if needed
    const now = Date.now();
    if (tokenData.expires_at && tokenData.expires_at <= now) {
      console.log('🔄 [GET-FOLDERS] Token expired, refreshing...');
      try {
        tokenData = await refreshTokenForM365Folders(supabase, mailbox_id, tokenData);
      } catch (refreshError) {
        console.error('❌ [GET-FOLDERS] Failed to refresh token:', refreshError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to refresh authentication token' }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Fetch folders from Microsoft Graph API
    console.log('🔍 [GET-FOLDERS] Fetching folders from Microsoft Graph API...');
    
    const foldersResponse = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!foldersResponse.ok) {
      const errorText = await foldersResponse.text();
      console.error(`❌ [GET-FOLDERS] Failed to fetch folders: ${foldersResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch folders: ${foldersResponse.status}` }),
        { 
          status: foldersResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const foldersData = await foldersResponse.json();
    const folders: MailboxFolder[] = foldersData.value || [];

    console.log(`✅ [GET-FOLDERS] Successfully fetched ${folders.length} folders`);

    // Filter and format folders for better UX
    const formattedFolders = folders
      .filter(folder => 
        // Exclude certain system folders that users shouldn't move emails to
        !['deleteditems', 'drafts', 'outbox', 'sentitems'].includes(folder.wellKnownName?.toLowerCase() || '')
      )
      .map(folder => ({
        id: folder.id,
        displayName: folder.displayName,
        parentFolderId: folder.parentFolderId,
        wellKnownName: folder.wellKnownName
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return new Response(
      JSON.stringify({ 
        success: true, 
        folders: formattedFolders 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ [GET-FOLDERS] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

// Helper function to refresh Microsoft Graph token
async function refreshTokenForM365Folders(supabase: any, mailboxId: string, tokenData: any) {
  console.log('🔄 [GET-FOLDERS] Refreshing Microsoft Graph token...');
  
  const refreshResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: Deno.env.get('MICROSOFT_CLIENT_ID') || '',
      client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET') || '',
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access'
    })
  });

  if (!refreshResponse.ok) {
    const errorText = await refreshResponse.text();
    console.error('❌ [GET-FOLDERS] Token refresh failed:', errorText);
    throw new Error(`Token refresh failed: ${refreshResponse.status}`);
  }

  const refreshData = await refreshResponse.json();
  
  // Calculate expiration time (subtract 5 minutes for safety)
  const expiresIn = refreshData.expires_in || 3600;
  const expiresAt = Date.now() + ((expiresIn - 300) * 1000);
  
  const newTokenData = {
    access_token: refreshData.access_token,
    refresh_token: refreshData.refresh_token || tokenData.refresh_token,
    expires_at: expiresAt,
    token_type: refreshData.token_type || 'Bearer'
  };

  // Update the token in the database
  const { error: updateError } = await supabase
    .from('mailboxes')
    .update({ 
      microsoft_graph_token: JSON.stringify(newTokenData),
      updated_at: new Date().toISOString()
    })
    .eq('id', mailboxId);

  if (updateError) {
    console.error('❌ [GET-FOLDERS] Failed to update token in database:', updateError);
    throw new Error('Failed to update token in database');
  }

  console.log('✅ [GET-FOLDERS] Token refreshed successfully');
  return newTokenData;
}

serve(handler);