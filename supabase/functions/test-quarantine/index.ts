import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get a quarantined email to test M365 move
    const { data: quarantinedEmails, error } = await supabase
      .from('emails')
      .select('*')
      .eq('processing_status', 'quarantined')
      .limit(1);

    if (error) {
      throw error;
    }

    if (!quarantinedEmails || quarantinedEmails.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No quarantined emails found to test'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 404
      });
    }

    const email = quarantinedEmails[0];
    console.log(`🧪 [TEST] Testing M365 Junk move for email: ${email.id} - "${email.subject}"`);

    // Test the M365 Junk folder move
    try {
      await moveEmailToJunkInM365(email, supabase);
      
      return new Response(JSON.stringify({
        success: true,
        message: `Successfully moved email "${email.subject}" to Junk folder in M365`,
        email_id: email.id
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 200
      });
    } catch (m365Error) {
      console.error('❌ [TEST] M365 Junk move failed:', m365Error);
      
      return new Response(JSON.stringify({
        success: false,
        message: `Failed to move email to Junk folder: ${m365Error.message}`,
        email_id: email.id,
        error: m365Error.message
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 500
      });
    }

  } catch (error) {
    console.error('❌ [TEST] Test quarantine failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 500
    });
  }
};

async function moveEmailToJunkInM365(email: any, supabase: any): Promise<void> {
  console.log(`🔄 [M365-JUNK] Starting M365 Junk folder move for email ${email.id} (${email.microsoft_id})`);
  
  // Get mailbox with Microsoft Graph token
  const { data: mailbox, error: mailboxError } = await supabase
    .from('mailboxes')
    .select('microsoft_graph_token')
    .eq('id', email.mailbox_id)
    .maybeSingle();

  if (mailboxError || !mailbox || !mailbox.microsoft_graph_token) {
    console.error('❌ [M365-JUNK] Mailbox or token not found:', mailboxError);
    throw new Error('Mailbox not connected to Microsoft Graph');
  }

  console.log(`🔑 [M365-JUNK] Token found, length: ${mailbox.microsoft_graph_token.length}`);

  // Parse the token
  let parsedToken;
  try {
    parsedToken = JSON.parse(mailbox.microsoft_graph_token);
    console.log(`🔑 [M365-JUNK] Token parsed successfully, expires at: ${new Date(parsedToken.expires_at || 0).toISOString()}`);
  } catch (error) {
    console.error('❌ [M365-JUNK] Failed to parse Microsoft Graph token:', error);
    throw new Error('Invalid Microsoft Graph token format');
  }

  // Check if token is expired and refresh if needed
  const now = Date.now();
  if (parsedToken.expires_at && parsedToken.expires_at <= now) {
    console.log('🔄 [M365-JUNK] Token expired, attempting to refresh...');
    
    if (!parsedToken.refresh_token) {
      console.error('❌ [M365-JUNK] No refresh token available');
      throw new Error('No refresh token available');
    }

    parsedToken = await refreshTokenForM365Category(parsedToken, email.mailbox_id, supabase);
    console.log('✅ [M365-JUNK] Token refreshed successfully');
  } else {
    console.log('✅ [M365-JUNK] Token is valid');
  }

  // First, get the Junk folder ID
  console.log(`🔍 [M365-JUNK] Getting Junk folder ID...`);
  
  const foldersResponse = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders', {
    headers: {
      'Authorization': `Bearer ${parsedToken.access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!foldersResponse.ok) {
    const foldersErrorText = await foldersResponse.text();
    console.error(`❌ [M365-JUNK] Failed to fetch folders: ${foldersResponse.status} - ${foldersErrorText}`);
    throw new Error(`Failed to fetch M365 folders: ${foldersResponse.status}`);
  }

  const foldersData = await foldersResponse.json();
  const folders = foldersData.value || [];
  
  // Find Junk folder (it might be called "Junk Email", "Junk", "Spam", etc.)
  const junkFolder = folders.find((folder: any) => 
    folder.displayName.toLowerCase().includes('junk') ||
    folder.displayName.toLowerCase().includes('spam') ||
    folder.wellKnownName === 'junkemail'
  );

  if (!junkFolder) {
    console.error('❌ [M365-JUNK] Junk folder not found');
    console.log('📋 [M365-JUNK] Available folders:', folders.map((f: any) => f.displayName));
    throw new Error('Junk folder not found in M365');
  }

  console.log(`📁 [M365-JUNK] Found Junk folder: "${junkFolder.displayName}" (ID: ${junkFolder.id})`);

  // Move email to Junk folder
  const moveUrl = `https://graph.microsoft.com/v1.0/me/messages/${email.microsoft_id}/move`;
  
  const moveData = {
    destinationId: junkFolder.id
  };

  console.log(`🔄 [M365-JUNK] Moving email to Junk folder...`);
  console.log(`📤 [M365-JUNK] Request URL: ${moveUrl}`);
  console.log(`📤 [M365-JUNK] Request body:`, JSON.stringify(moveData, null, 2));
  
  const moveResponse = await fetch(moveUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${parsedToken.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(moveData)
  });

  console.log(`📥 [M365-JUNK] Response status: ${moveResponse.status}`);
  
  if (!moveResponse.ok) {
    const errorText = await moveResponse.text();
    console.error(`❌ [M365-JUNK] Failed to move email to Junk folder: ${moveResponse.status} - ${errorText}`);
    
    // Log detailed error information
    console.error(`🔍 [M365-JUNK] Error details:`);
    console.error(`  - Email ID: ${email.id}`);
    console.error(`  - Microsoft ID: ${email.microsoft_id}`);
    console.error(`  - Junk Folder ID: ${junkFolder.id}`);
    console.error(`  - Mailbox ID: ${email.mailbox_id}`);
    
    throw new Error(`Failed to move email to Junk folder: ${moveResponse.status} - ${errorText}`);
  }

  const moveResult = await moveResponse.json();
  console.log(`✅ [M365-JUNK] Email successfully moved to Junk folder`);
  console.log(`📋 [M365-JUNK] Move result:`, moveResult);
}

async function refreshTokenForM365Category(tokenData: any, mailboxId: string, supabase: any): Promise<any> {
  console.log('🔄 Refreshing Microsoft Graph token for M365 category application...');

  const refreshResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: Deno.env.get('MICROSOFT_CLIENT_ID') || '',
      client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET') || '',
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!refreshResponse.ok) {
    const errorText = await refreshResponse.text();
    console.error('❌ Failed to refresh token:', errorText);
    throw new Error(`Token refresh failed: ${refreshResponse.status}`);
  }

  const refreshData = await refreshResponse.json();
  
  const updatedTokenData = {
    access_token: refreshData.access_token,
    refresh_token: refreshData.refresh_token || tokenData.refresh_token,
    expires_at: Date.now() + (refreshData.expires_in * 1000),
    scope: refreshData.scope || tokenData.scope,
  };

  // Update the token in the database
  await supabase
    .from('mailboxes')
    .update({ microsoft_graph_token: JSON.stringify(updatedTokenData) })
    .eq('id', mailboxId);

  console.log('✅ Token refreshed successfully for M365 category application');
  return updatedTokenData;
}

serve(handler);