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
    } else if (action === 'process_mailbox' && mailbox_id) {
      // Process a specific mailbox for all VIP emails
      await processMailboxForAllVips(mailbox_id, tenant_id);
    }

    return new Response(
      JSON.stringify({ success: true, message: `VIP status updated successfully` }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error updating VIP status:', error);
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
  console.log(`Processing all mailboxes for VIP ${isVip ? 'add' : 'remove'}: ${emailAddress}`);

  // Get all active mailboxes for this tenant
  const { data: mailboxes, error } = await supabase
    .from('mailboxes')
    .select('id, email_address, microsoft_graph_token')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .not('microsoft_graph_token', 'is', null);

  if (error) {
    console.error('Error fetching mailboxes:', error);
    return;
  }

  if (!mailboxes || mailboxes.length === 0) {
    console.log('No active mailboxes found for tenant');
    return;
  }

  console.log(`Found ${mailboxes.length} mailboxes to process`);

  // Process each mailbox
  for (const mailbox of mailboxes) {
    try {
      await updateEmailsInMailbox(mailbox, emailAddress, isVip);
    } catch (error) {
      console.error(`Error processing mailbox ${mailbox.email_address}:`, error);
    }
  }
}

async function processMailboxForAllVips(mailboxId: string, tenantId: string) {
  console.log(`Processing mailbox ${mailboxId} for all VIPs`);

  // Get mailbox details
  const { data: mailbox, error: mailboxError } = await supabase
    .from('mailboxes')
    .select('id, email_address, microsoft_graph_token')
    .eq('id', mailboxId)
    .eq('tenant_id', tenantId)
    .single();

  if (mailboxError || !mailbox) {
    console.error('Error fetching mailbox:', mailboxError);
    return;
  }

  // Get all VIP email addresses for this tenant
  const { data: vipEmails, error: vipError } = await supabase
    .from('vip_email_addresses')
    .select('email_address')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (vipError) {
    console.error('Error fetching VIP emails:', vipError);
    return;
  }

  if (!vipEmails || vipEmails.length === 0) {
    console.log('No VIP emails found for tenant');
    return;
  }

  console.log(`Processing ${vipEmails.length} VIP emails for mailbox`);

  // Process each VIP email
  for (const vip of vipEmails) {
    try {
      await updateEmailsInMailbox(mailbox, vip.email_address, true);
    } catch (error) {
      console.error(`Error processing VIP ${vip.email_address}:`, error);
    }
  }
}

async function updateEmailsInMailbox(mailbox: MailboxToken, senderEmail: string, isVip: boolean) {
  console.log(`Updating emails from ${senderEmail} in ${mailbox.email_address} - VIP: ${isVip}`);

  try {
    // First, ensure the VIP category exists in Outlook
    await ensureVipCategory(mailbox.microsoft_graph_token);

    // Search for emails from this sender (last 90 days to avoid too many results)
    const searchUrl = `https://graph.microsoft.com/v1.0/me/messages?$filter=from/emailAddress/address eq '${senderEmail}' and receivedDateTime ge ${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()}&$select=id,subject,from,receivedDateTime,categories,importance&$top=100`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${mailbox.microsoft_graph_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!searchResponse.ok) {
      console.error(`Graph API search failed: ${searchResponse.status} ${searchResponse.statusText}`);
      return;
    }

    const searchData = await searchResponse.json();
    console.log(`Found ${searchData.value?.length || 0} emails from ${senderEmail}`);

    if (!searchData.value || searchData.value.length === 0) {
      return;
    }

    // Process each email
    let updatedCount = 0;
    for (const email of searchData.value) {
      try {
        const categories = email.categories || [];
        const hasVipCategory = categories.includes('VIP Important');
        
        if (isVip && !hasVipCategory) {
          // Add VIP category and set high importance
          const updatedCategories = [...categories, 'VIP Important'];
          await updateEmailProperties(mailbox.microsoft_graph_token, email.id, {
            categories: updatedCategories,
            importance: 'high'
          });
          updatedCount++;
        } else if (!isVip && hasVipCategory) {
          // Remove VIP category and reset importance
          const updatedCategories = categories.filter((cat: string) => cat !== 'VIP Important');
          await updateEmailProperties(mailbox.microsoft_graph_token, email.id, {
            categories: updatedCategories,
            importance: 'normal'
          });
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error updating email ${email.id}:`, error);
      }
    }

    console.log(`Updated ${updatedCount} emails from ${senderEmail}`);

    // Update the database to mark emails as VIP
    if (isVip) {
      await supabase
        .from('emails')
        .update({ is_vip: true })
        .eq('mailbox_id', mailbox.id)
        .eq('sender_email', senderEmail);
    } else {
      await supabase
        .from('emails')
        .update({ is_vip: false })
        .eq('mailbox_id', mailbox.id)
        .eq('sender_email', senderEmail);
    }

  } catch (error) {
    console.error(`Error processing emails for ${senderEmail}:`, error);
  }
}

async function ensureVipCategory(token: string) {
  try {
    // Check if VIP category exists
    const categoriesResponse = await fetch('https://graph.microsoft.com/v1.0/me/outlook/masterCategories', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!categoriesResponse.ok) {
      console.error('Failed to fetch categories');
      return;
    }

    const categoriesData = await categoriesResponse.json();
    const hasVipCategory = categoriesData.value?.some((cat: any) => cat.displayName === 'VIP Important');

    if (!hasVipCategory) {
      // Create VIP category with gold color
      await fetch('https://graph.microsoft.com/v1.0/me/outlook/masterCategories', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName: 'VIP Important',
          color: 'preset2' // Gold color
        })
      });
      console.log('Created VIP Important category');
    }
  } catch (error) {
    console.error('Error ensuring VIP category:', error);
  }
}

async function updateEmailProperties(token: string, messageId: string, properties: any) {
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(properties)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update email: ${response.status} ${errorText}`);
  }
}