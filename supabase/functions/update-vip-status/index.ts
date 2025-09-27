import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface VipUpdateRequest {
  action: 'add' | 'remove' | 'process_mailbox';
  email_address?: string;
  mailbox_id?: string;
  tenant_id: string;
}

interface MailboxToken {
  id: string;
  email_address: string; 
  microsoft_graph_token: string;
}

// Helper function to refresh Microsoft Graph token
async function refreshToken(tokenData: any, mailboxId: string, supabase: any): Promise<any> {
  const refreshUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  
  const params = new URLSearchParams({
    client_id: '80b5126b-2f86-4a4d-8d55-43afbd7c970e',
    client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET') ?? '',
    scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/MailboxSettings.ReadWrite offline_access',
    refresh_token: tokenData.refresh_token,
    grant_type: 'refresh_token'
  });

  const response = await fetch(refreshUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  const newTokenData = await response.json();
  
  const expiresAt = Date.now() + (newTokenData.expires_in * 1000);
  const updatedTokenData = {
    access_token: newTokenData.access_token,
    refresh_token: newTokenData.refresh_token || tokenData.refresh_token,
    expires_at: expiresAt
  };

  await supabase
    .from('mailboxes')
    .update({ microsoft_graph_token: JSON.stringify(updatedTokenData) })
    .eq('id', mailboxId);

  console.log('Token refreshed successfully for VIP update');
  return updatedTokenData;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, email_address, mailbox_id, tenant_id }: VipUpdateRequest = await req.json();
    
    console.log(`Processing VIP update: ${action} for ${email_address || 'all emails'}`);

    if (action === 'add' || action === 'remove') {
      // Process all mailboxes in the tenant to update VIP status
      await processAllMailboxesForVip(tenant_id, email_address!, action === 'add');
    } else if (action === 'process_mailbox') {
      if (mailbox_id) {
        // Process a specific mailbox for all VIP emails
        await processMailboxForAllVips(mailbox_id, tenant_id);
      } else {
        // Process all mailboxes for all VIP emails
        await processAllMailboxesForAllVips(tenant_id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'VIP status updated' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error processing VIP update:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function processAllMailboxesForVip(tenantId: string, emailAddress: string, isVip: boolean) {
  console.log(`📊 Processing all mailboxes for VIP: ${emailAddress} (is_vip: ${isVip})`);
  
  // Get all connected mailboxes for this tenant
  const { data: mailboxes, error: mailboxError } = await supabase
    .from('mailboxes')
    .select('id, email_address, microsoft_graph_token')
    .eq('tenant_id', tenantId)
    .eq('status', 'connected');

  if (mailboxError) {
    console.error('Error fetching mailboxes:', mailboxError);
    throw mailboxError;
  }

  if (!mailboxes || mailboxes.length === 0) {
    console.log('⚠️ No connected mailboxes found for tenant');
    return;
  }

  console.log(`✅ Found ${mailboxes.length} connected mailboxes: ${JSON.stringify(mailboxes.map(m => m.email_address))}`);

  // Update each mailbox
  for (const mailbox of mailboxes) {
    try {
      await updateEmailsInMailbox(mailbox, emailAddress, isVip);
    } catch (error) {
      console.error(`Error processing mailbox ${mailbox.email_address}:`, error);
    }
  }
}

async function processAllMailboxesForAllVips(tenantId: string) {
  console.log(`🔄 Processing all mailboxes for all VIPs in tenant ${tenantId}`);
  
  // Get all connected mailboxes for this tenant
  const { data: mailboxes, error: mailboxError } = await supabase
    .from('mailboxes')
    .select('id, email_address, microsoft_graph_token')
    .eq('tenant_id', tenantId)
    .eq('status', 'connected');

  if (mailboxError) {
    console.error('Error fetching mailboxes:', mailboxError);
    throw mailboxError;
  }

  if (!mailboxes || mailboxes.length === 0) {
    console.log('⚠️ No connected mailboxes found for tenant');
    return;
  }

  console.log(`✅ Found ${mailboxes.length} connected mailboxes: ${JSON.stringify(mailboxes.map(m => m.email_address))}`);

  // Get all VIP email addresses for this tenant
  const { data: vipEmails, error: vipError } = await supabase
    .from('vip_email_addresses')
    .select('email_address')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (vipError) {
    console.error('Error fetching VIP emails:', vipError);
    throw vipError;
  }

  if (!vipEmails || vipEmails.length === 0) {
    console.log('⚠️ No VIP emails found for tenant');
    return;
  }

  console.log(`✅ Found ${vipEmails.length} VIP emails: ${vipEmails.map(v => v.email_address).join(', ')}`);

  // First, update database for ALL VIP emails across ALL mailboxes
  console.log(`📊 Updating database records for VIP emails...`);
  for (const vip of vipEmails) {
    console.log(`📊 Updating database records for VIP: ${vip.email_address}`);
    
    // Get existing emails from this VIP sender
    const { data: existingEmails, error: emailError } = await supabase
      .from('emails')
      .select('id, is_vip')
      .eq('tenant_id', tenantId)
      .eq('sender_email', vip.email_address);

    if (emailError) {
      console.error(`❌ Error fetching emails for ${vip.email_address}:`, emailError);
      continue;
    }

    console.log(`📧 Found ${existingEmails?.length || 0} existing emails from ${vip.email_address}`);
    
    if (existingEmails && existingEmails.length > 0) {
      const vipCount = existingEmails.filter(e => e.is_vip).length;
      const nonVipCount = existingEmails.filter(e => !e.is_vip).length;
      console.log(`⭐ ${vipCount} already marked as VIP, ${nonVipCount} need updating`);

      if (nonVipCount > 0) {
        const { data: updateResult, error: updateError } = await supabase
          .from('emails')
          .update({ is_vip: true })
          .eq('tenant_id', tenantId)
          .eq('sender_email', vip.email_address)
          .eq('is_vip', false)
          .select('id');

        if (updateError) {
          console.error(`❌ Error updating VIP status for ${vip.email_address}:`, updateError);
        } else {
          console.log(`✅ Updated ${updateResult?.length || 0} emails to VIP status for ${vip.email_address}`);
        }
      }
    }
  }

  // Then process Outlook integration for each mailbox/VIP combination
  for (const mailbox of mailboxes) {
    for (const vip of vipEmails) {
      try {
        console.log(`🔄 Updating emails from ${vip.email_address} in ${mailbox.email_address} - VIP: true`);
        await updateEmailsInMailbox(mailbox, vip.email_address, true);
      } catch (error) {
        console.error(`Error processing VIP ${vip.email_address} in mailbox ${mailbox.email_address}:`, error);
      }
    }
  }

  console.log(`🎉 Completed processing all VIPs for all mailboxes`);
}

async function processMailboxForAllVips(mailboxId: string, tenantId: string) {
  console.log(`🔄 Processing mailbox ${mailboxId} for all VIPs in tenant ${tenantId}`);
  
  // Get the specific mailbox
  const { data: mailbox, error: mailboxError } = await supabase
    .from('mailboxes')
    .select('id, email_address, microsoft_graph_token')
    .eq('id', mailboxId)
    .eq('tenant_id', tenantId)
    .eq('status', 'connected')
    .single();

  if (mailboxError || !mailbox) {
    console.error('Error fetching mailbox:', mailboxError);
    throw mailboxError || new Error('Mailbox not found');
  }

  // Get all VIP email addresses for this tenant
  const { data: vipEmails, error: vipError } = await supabase
    .from('vip_email_addresses')
    .select('email_address')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (vipError) {
    console.error('Error fetching VIP emails:', vipError);
    throw vipError;
  }

  if (!vipEmails || vipEmails.length === 0) {
    console.log('⚠️ No VIP emails found for tenant');
    return;
  }

  console.log(`✅ Found ${vipEmails.length} VIP emails: ${vipEmails.map(v => v.email_address).join(', ')}`);

  // Process each VIP email for this mailbox
  for (const vip of vipEmails) {
    try {
      await updateEmailsInMailbox(mailbox, vip.email_address, true);
    } catch (error) {
      console.error(`Error processing VIP ${vip.email_address}:`, error);
    }
  }
}

async function updateEmailsInMailbox(mailbox: MailboxToken, senderEmail: string, isVip: boolean) {
  console.log(`🔄 Updating emails from ${senderEmail} in ${mailbox.email_address} - VIP: ${isVip}`);

  // Always update the database first, regardless of Microsoft Graph API status
  console.log(`💾 Updating database VIP status for emails from ${senderEmail}...`);
  
  if (isVip) {
    const { data: dbUpdateResult, error: dbError } = await supabase
      .from('emails')
      .update({ is_vip: true })
      .eq('mailbox_id', mailbox.id)
      .eq('sender_email', senderEmail)
      .eq('is_vip', false) // Only update those not already VIP
      .select('id');

    if (dbError) {
      console.error(`❌ Database update error for ${senderEmail}:`, dbError);
    } else {
      console.log(`✅ Database: Updated ${dbUpdateResult?.length || 0} emails to VIP status`);
    }
  } else {
    const { data: dbUpdateResult, error: dbError } = await supabase
      .from('emails')
      .update({ is_vip: false })
      .eq('mailbox_id', mailbox.id)
      .eq('sender_email', senderEmail)
      .eq('is_vip', true) // Only update those currently VIP
      .select('id');

    if (dbError) {
      console.error(`❌ Database update error for ${senderEmail}:`, dbError);
    } else {
      console.log(`✅ Database: Removed VIP status from ${dbUpdateResult?.length || 0} emails`);
    }
  }

  // Now try Microsoft Graph integration (but don't let failures stop the process)
  try {
    // Check if token needs refresh
    let activeToken = mailbox.microsoft_graph_token;
    const tokenData = JSON.parse(mailbox.microsoft_graph_token || '{}');
    
    if (tokenData.expires_at && tokenData.expires_at < Date.now()) {
      console.log(`🔄 Token expired, refreshing for mailbox ${mailbox.email_address}...`);
      try {
        const refreshedToken = await refreshToken(tokenData, mailbox.id, supabase);
        activeToken = JSON.stringify(refreshedToken);
        console.log(`✅ Token refreshed successfully`);
      } catch (refreshError) {
        console.error(`❌ Token refresh failed:`, refreshError);
        return; // Skip Microsoft Graph operations if token refresh fails
      }
    }

    // First, ensure the VIP category exists in Outlook
    console.log(`🏷️ Ensuring VIP category exists in Outlook...`);
    await ensureVipCategory(JSON.parse(activeToken).access_token);

    // Search for emails from this sender (last 90 days to avoid too many results)
    const searchUrl = `https://graph.microsoft.com/v1.0/me/messages?$filter=from/emailAddress/address eq '${senderEmail}' and receivedDateTime ge ${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()}&$select=id,subject,from,receivedDateTime,categories,importance&$top=100`;
    
    console.log(`🔍 Searching for emails from ${senderEmail} in Microsoft Graph...`);
    console.log(`🔗 Search URL: ${searchUrl}`);
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${JSON.parse(activeToken).access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error(`❌ Graph API search failed: ${searchResponse.status} ${searchResponse.statusText}`);
      console.error(`❌ Error details: ${errorText}`);
      return;
    }

    const searchData = await searchResponse.json();
    console.log(`📧 Found ${searchData.value?.length || 0} emails from ${senderEmail} in last 90 days`);

    if (!searchData.value || searchData.value.length === 0) {
      console.log(`ℹ️ No emails found from ${senderEmail} in Outlook`);
      return;
    }

    // Process each email
    let updatedCount = 0;
    let skippedCount = 0;

    for (const email of searchData.value) {
      try {
        const currentCategories = email.categories || [];
        const hasVipCategory = currentCategories.includes('VIP Important');
        
        if (isVip && !hasVipCategory) {
          // Add VIP category
          const updatedCategories = [...currentCategories, 'VIP Important'];
          await updateEmailProperties(
            email.id,
            updatedCategories,
            'high',
            JSON.parse(activeToken).access_token
          );
          updatedCount++;
          console.log(`✅ Added VIP category to: ${email.subject}`);
        } else if (!isVip && hasVipCategory) {
          // Remove VIP category
          const updatedCategories = currentCategories.filter((cat: string) => cat !== 'VIP Important');
          await updateEmailProperties(
            email.id,
            updatedCategories,
            'normal',
            JSON.parse(activeToken).access_token
          );
          updatedCount++;
          console.log(`✅ Removed VIP category from: ${email.subject}`);
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Error updating email ${email.id}:`, error);
      }
    }

    console.log(`🎯 Outlook Update Summary: ${updatedCount} emails updated, ${skippedCount} skipped (already correct)`);

  } catch (error) {
    console.error(`❌ Microsoft Graph integration failed for ${senderEmail}:`, error);
    // Continue anyway - database is already updated
  }
}

async function ensureVipCategory(token: string): Promise<void> {
  // Check if VIP Important category exists
  const categoriesResponse = await fetch('https://graph.microsoft.com/v1.0/me/outlook/masterCategories', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!categoriesResponse.ok) {
    console.error('Failed to fetch categories');
    throw new Error(`Failed to fetch categories: ${categoriesResponse.status}`);
  }

  const categoriesData = await categoriesResponse.json();
  const vipCategoryExists = categoriesData.value?.some((cat: any) => cat.displayName === 'VIP Important');

  if (!vipCategoryExists) {
    console.log('🏷️ Creating VIP Important category...');
    // Create the VIP Important category
    const createResponse = await fetch('https://graph.microsoft.com/v1.0/me/outlook/masterCategories', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        displayName: 'VIP Important',
        color: 'preset9' // Orange/Gold color that matches platform VIP styling
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      
      // Handle 409 (Conflict) as success - category already exists
      if (createResponse.status === 409) {
        console.log('✅ VIP Important category already exists (409 conflict)');
        return;
      }
      
      console.error('Failed to create VIP category');
      throw new Error(`Failed to create VIP category: ${createResponse.status} - ${errorText}`);
    }
    
    console.log('✅ VIP Important category created successfully');
  } else {
    console.log('✅ VIP Important category already exists');
  }
}

async function updateEmailProperties(emailId: string, categories: string[], importance: string, token: string): Promise<void> {
  const updateUrl = `https://graph.microsoft.com/v1.0/me/messages/${emailId}`;
  
  await fetch(updateUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      categories: categories,
      importance: importance
    })
  });
}