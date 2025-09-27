import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Microsoft Graph API preset colors mapped to hex colors
const OUTLOOK_COLOR_MAP: { [key: string]: string } = {
  'preset0': '#ff1a1a', // Red
  'preset1': '#ff8c00', // Orange  
  'preset2': '#f4b942', // Yellow/Gold
  'preset3': '#009639', // Green
  'preset4': '#00b7c3', // Teal
  'preset5': '#0078d4', // Blue
  'preset6': '#4c51bf', // Purple
  'preset7': '#e3008c', // Pink
  'preset8': '#881798', // Dark Purple
  'preset9': '#ff8c00', // Orange (VIP color)
  'preset10': '#00cc6a', // Light Green
  'preset11': '#5c2e91', // Dark Purple
  'preset12': '#0078d4', // Light Blue
  'preset13': '#69797e', // Gray
  'preset14': '#d83b01', // Dark Orange
  'preset15': '#b146c2', // Magenta
  'preset16': '#00bcf2', // Cyan
  'preset17': '#498205', // Olive
  'preset18': '#da3b01', // Red Orange
  'preset19': '#8764b8', // Lavender
  'preset20': '#00b7c3', // Aqua
  'preset21': '#038387', // Dark Teal
  'preset22': '#b4009e', // Dark Pink
  'preset23': '#5c2e91', // Indigo
  'preset24': '#c239b3'  // Bright Pink
};

// Reverse mapping: hex to preset
const HEX_TO_PRESET: { [key: string]: string } = {};
Object.entries(OUTLOOK_COLOR_MAP).forEach(([preset, hex]) => {
  HEX_TO_PRESET[hex.toLowerCase()] = preset;
});

// Function to find the closest preset for a hex color
function findClosestPreset(hexColor: string): string {
  const cleanHex = hexColor.replace('#', '').toLowerCase();
  
  // Direct match
  if (HEX_TO_PRESET[`#${cleanHex}`]) {
    return HEX_TO_PRESET[`#${cleanHex}`];
  }
  
  // Convert hex to RGB for color matching
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);
  
  let closestPreset = 'preset9'; // Default to VIP orange
  let minDistance = Infinity;
  
  Object.entries(OUTLOOK_COLOR_MAP).forEach(([preset, hex]) => {
    const cleanTargetHex = hex.replace('#', '');
    const tr = parseInt(cleanTargetHex.substr(0, 2), 16);
    const tg = parseInt(cleanTargetHex.substr(2, 2), 16);
    const tb = parseInt(cleanTargetHex.substr(4, 2), 16);
    
    // Euclidean distance in RGB space
    const distance = Math.sqrt((r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2);
    
    if (distance < minDistance) {
      minDistance = distance;
      closestPreset = preset;
    }
  });
  
  return closestPreset;
}

async function refreshToken(tokenData: any, mailboxId: string, supabase: any) {
  if (!tokenData.refresh_token) {
    throw new Error('No refresh token available');
  }

  const refreshUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  const refreshParams = new URLSearchParams({
    client_id: Deno.env.get("MICROSOFT_APP_ID") || '',
    client_secret: Deno.env.get("MICROSOFT_CLIENT_SECRET") || '',
    refresh_token: tokenData.refresh_token,
    grant_type: 'refresh_token',
    scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access'
  });

  const refreshResponse = await fetch(refreshUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: refreshParams.toString()
  });

  if (!refreshResponse.ok) {
    throw new Error(`Token refresh failed: ${refreshResponse.status}`);
  }

  const refreshData = await refreshResponse.json();
  const newTokenData = {
    access_token: refreshData.access_token,
    refresh_token: refreshData.refresh_token || tokenData.refresh_token,
    expires_at: Date.now() + (refreshData.expires_in * 1000)
  };

  // Update the mailbox with the new token
  const { error: updateError } = await supabase
    .from('mailboxes')
    .update({ microsoft_graph_token: JSON.stringify(newTokenData) })
    .eq('id', mailboxId);

  if (updateError) {
    console.error('Failed to update token in database:', updateError);
  }

  return newTokenData;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { tenant_id, mailbox_id } = await req.json();
    
    console.log('🎨 Starting category color synchronization');

    // Get user's email categories
    const { data: categories, error: categoriesError } = await supabaseClient
      .from('email_categories')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true);

    if (categoriesError) {
      throw new Error(`Failed to fetch categories: ${categoriesError.message}`);
    }

    if (!categories || categories.length === 0) {
      console.log('No categories found to sync');
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No categories to sync",
        synced: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get mailbox for token
    const { data: mailbox, error: mailboxError } = await supabaseClient
      .from('mailboxes')
      .select('*')
      .eq('id', mailbox_id || categories[0].mailbox_id)
      .eq('status', 'connected')
      .not('microsoft_graph_token', 'is', null)
      .single();

    if (mailboxError || !mailbox) {
      throw new Error('No connected mailbox found');
    }

    // Check if token needs refresh
    let activeToken = mailbox.microsoft_graph_token;
    const tokenData = JSON.parse(mailbox.microsoft_graph_token);
    
    if (tokenData.expires_at && tokenData.expires_at < Date.now()) {
      console.log('🔄 Token expired, refreshing...');
      try {
        const refreshedToken = await refreshToken(tokenData, mailbox.id, supabaseClient);
        activeToken = JSON.stringify(refreshedToken);
      } catch (refreshError) {
        throw new Error(`Token refresh failed: ${refreshError}`);
      }
    }

    const token = JSON.parse(activeToken).access_token;

    // Fetch existing Outlook categories
    const categoriesResponse = await fetch('https://graph.microsoft.com/v1.0/me/outlook/masterCategories', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!categoriesResponse.ok) {
      throw new Error(`Failed to fetch Outlook categories: ${categoriesResponse.status}`);
    }

    const outlookCategoriesData = await categoriesResponse.json();
    const outlookCategories = outlookCategoriesData.value || [];

    let syncedCount = 0;

    // Sync each category
    for (const category of categories) {
      try {
        console.log(`🎨 Syncing category: ${category.name}`);
        
        // Find matching Outlook category
        const outlookCategory = outlookCategories.find((cat: any) => 
          cat.displayName === category.name
        );

        if (outlookCategory) {
          // Find the best preset color match
          const targetPreset = findClosestPreset(category.color || '#ff8c00');
          const currentPreset = outlookCategory.color;

          if (currentPreset !== targetPreset) {
            console.log(`🎨 Updating ${category.name} color from ${currentPreset} to ${targetPreset}`);
            
            // Update the category color in Outlook
            const updateResponse = await fetch(`https://graph.microsoft.com/v1.0/me/outlook/masterCategories/${outlookCategory.id}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                color: targetPreset
              })
            });

            if (updateResponse.ok) {
              console.log(`✅ Updated ${category.name} color successfully`);
              
              // Update platform category with the actual Outlook hex color
              await supabaseClient
                .from('email_categories')
                .update({ 
                  color: OUTLOOK_COLOR_MAP[targetPreset] || category.color,
                  updated_at: new Date().toISOString()
                })
                .eq('id', category.id);
                
              syncedCount++;
            } else {
              console.error(`❌ Failed to update ${category.name} color: ${updateResponse.status}`);
            }
          } else {
            console.log(`✅ ${category.name} color already matches (${currentPreset})`);
            syncedCount++;
          }
        } else {
          console.log(`⚠️ Category ${category.name} not found in Outlook - may need to be created first`);
        }
      } catch (error) {
        console.error(`❌ Error syncing category ${category.name}:`, error);
      }
    }

    console.log(`🎉 Category color sync completed: ${syncedCount}/${categories.length} categories synced`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Synced ${syncedCount} of ${categories.length} categories`,
      synced: syncedCount,
      total: categories.length,
      colorMap: OUTLOOK_COLOR_MAP
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error in category color sync:', errorMessage);
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});