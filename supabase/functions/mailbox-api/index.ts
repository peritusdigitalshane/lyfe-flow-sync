import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { Database } from "../_shared/types.ts";
import { corsHeaders, getErrorMessage, createErrorResponse, createSuccessResponse } from "../_shared/utils.ts";

interface LogAuditEventData {
  tenant_id: string;
  mailbox_id?: string | null;
  details?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting edge function execution...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('Environment check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseKey: !!supabaseKey,
      supabaseUrl: supabaseUrl ? 'configured' : 'missing'
    });

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Server configuration error',
          details: 'Missing Supabase environment variables'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    
    console.log('Request details:', { path, method, url: req.url });

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header found');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Authentication required',
          details: 'Missing authorization header'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Attempting to authenticate user...');
    let user, authError;
    
    try {
      const result = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
      user = result.data?.user;
      authError = result.error;
    } catch (error) {
      console.error('Authentication error:', error);
      return createErrorResponse(error, 'Authentication failed', 200);
    }

    if (authError || !user) {
      console.error('Invalid token or user not found:', authError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid token',
          details: authError?.message || 'User not found'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User authenticated successfully:', user.id);

    // Get user's tenant_id
    console.log('Fetching user profile...');
    let profile, profileError;
    
    try {
      const result = await supabaseClient
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      
      profile = result.data;
      profileError = result.error;
    } catch (error) {
      console.error('Profile fetch error:', error);
      return createErrorResponse(error, 'Failed to fetch user profile', 200);
    }

    if (profileError || !profile) {
      console.error('Profile not found or error:', profileError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Profile not found',
          details: profileError?.message || 'User profile does not exist'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = (profile as any)?.tenant_id;
    console.log('User authenticated:', { userId: user.id, tenantId });

    // Route handling
    console.log('Checking routes for:', path, method);
    if (path.includes('/mailbox-api') && method === 'POST') {
      console.log('Matched mailbox creation route');
      
      let requestData;
      try {
        requestData = await req.json();
        console.log('Parsed request data:', requestData);
      } catch (error) {
        console.error('JSON parsing error:', error);
        return createErrorResponse(error, 'Invalid request format', 200);
      }

      const { action } = requestData;
      console.log('Action from request:', action);

      if (action === 'check_oauth') {
        console.log('Checking OAuth configuration...');
        
        let oauthConfig: { value?: any } | null = null;
        try {
          const oauthResult = await supabaseClient
            .from('app_settings')
            .select('value')
            .eq('key', 'microsoft_oauth_config')
            .single();

          console.log('OAuth query result:', { error: oauthResult.error, hasData: !!oauthResult.data });
          oauthConfig = oauthResult.data as { value?: any } | null;
        } catch (error) {
          console.error('Database query error:', error);
          return createErrorResponse(error, 'Failed to check OAuth configuration', 200);
        }

        console.log('OAuth config check:', {
          hasConfig: !!oauthConfig,
          hasValue: !!oauthConfig?.value,
        });

        if (oauthConfig?.value) {
          const config = oauthConfig.value as any;
          console.log('OAuth config found, preparing update for existing mailbox');
          
          // Find existing mailbox for this user to update for re-authentication
          const { data: existingMailbox, error: mailboxError } = await supabaseClient
            .from('mailboxes')
            .select('*')
            .eq('user_id', user.id)
            .eq('tenant_id', tenantId)
            .eq('email_address', requestData.email_address)
            .single();

          if (!mailboxError && existingMailbox) {
            const mailboxData = existingMailbox as Database['public']['Tables']['mailboxes']['Row'];
            console.log('Found existing mailbox, updating for re-authentication:', mailboxData.id);
            
            // Update mailbox to pending status for re-authentication
            try {
              const updateData: Database['public']['Tables']['mailboxes']['Update'] = { 
                status: 'pending',
                error_message: null 
              };
              
              await supabaseClient
                .from('mailboxes')
                .update(updateData)
                .eq('id', mailboxData.id);
              
              console.log('Mailbox updated for re-authentication:', mailboxData.id);
              
              return new Response(
                JSON.stringify({ 
                  success: true,
                  oauth_configured: true,
                  redirect_url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${config.client_id}&response_type=code&redirect_uri=${encodeURIComponent(config.redirect_uri)}&scope=${encodeURIComponent('https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/User.Read offline_access')}&state=${mailboxData.id}&prompt=consent`
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } catch (error) {
              console.error('Failed to update mailbox for re-authentication:', error);
              return createErrorResponse(error, 'Failed to prepare mailbox for re-authentication', 200);
            }
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            oauth_configured: !!oauthConfig?.value,
            redirect_url: oauthConfig?.value ? 
              `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${oauthConfig.value.client_id}&response_type=code&redirect_uri=${encodeURIComponent(oauthConfig.value.redirect_uri)}&scope=${encodeURIComponent('https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/User.Read offline_access')}&state=new&prompt=consent`
              : null
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'create') {
        console.log('Creating new mailbox...');
        const { email_address, display_name } = requestData;
        
        // Create mailbox with proper typing
        let mailbox: Database['public']['Tables']['mailboxes']['Row'] | null = null;
        try {
          const insertData: Database['public']['Tables']['mailboxes']['Insert'] = {
            tenant_id: tenantId,
            user_id: user.id,
            email_address: email_address,
            display_name: display_name,
            status: 'pending'
          };
          
          const result = await supabaseClient
            .from('mailboxes')
            .insert(insertData)
            .select()
            .single();

          if (result.error) {
            throw result.error;
          }
          
          mailbox = result.data as Database['public']['Tables']['mailboxes']['Row'];
        } catch (error) {
          console.error('Failed to create mailbox:', error);
          return createErrorResponse(error, 'Failed to create mailbox', 200);
        }

        if (!mailbox) {
          return createErrorResponse(null, 'Mailbox creation returned null', 200);
        }

        console.log('Mailbox created successfully:', mailbox.id);

        // Insert audit log
        await logAuditEvent(supabaseClient, {
          tenant_id: tenantId,
          mailbox_id: mailbox.id,
        }, mailbox.id, user.id, req);

        return new Response(
          JSON.stringify({ 
            success: true,
            mailbox: mailbox
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (path.includes('/mailbox-management') && method === 'POST') {
      console.log('Matched mailbox management route');
      
      let requestData;
      try {
        requestData = await req.json();
        console.log('Management request data:', requestData);
      } catch (error) {
        console.error('JSON parsing error:', error);
        return createErrorResponse(error, 'Invalid request format', 200);
      }

      const { action, mailbox_id: mailboxId } = requestData;
      console.log('Management action:', action);

      if (!mailboxId) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Mailbox ID required'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const { data: mailboxData, error: mailboxError } = await supabaseClient
          .from('mailboxes')
          .select('*')
          .eq('id', mailboxId)
          .eq('tenant_id', tenantId)
          .eq('user_id', user.id)
          .single();

        if (mailboxError || !mailboxData) {
          console.error('Mailbox not found or access denied:', mailboxError);
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Mailbox not found',
              details: mailboxError?.message || 'Mailbox does not exist'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const mailbox = mailboxData as Database['public']['Tables']['mailboxes']['Row'];
      } catch (error) {
        console.error('Database query error:', error);
        return createErrorResponse(error, 'Failed to fetch mailbox', 200);
      }

      const newStatus = action === 'pause' ? 'paused' : 'connected';
      
      // Update database directly (no n8n integration needed)

      // Update database
      try {
        const updateData: Database['public']['Tables']['mailboxes']['Update'] = { status: newStatus };
        await supabaseClient
          .from('mailboxes')
          .update(updateData)
          .eq('id', mailboxId);
      } catch (error) {
        console.error('Failed to update mailbox status:', error);
        return createErrorResponse(error, 'Failed to update mailbox status', 200);
      }

      // Log audit trail
      await logAuditEvent(supabaseClient, {
        tenant_id: tenantId,
        mailbox_id: mailboxId,
        details: { action: action }
      }, mailboxId, user.id, req);

      return new Response(
        JSON.stringify({ 
          success: true,
          status: newStatus
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default response for unmatched routes
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Invalid endpoint or method',
        details: `${method} ${path} not supported`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    } catch (error) {
      console.error('Unexpected error in mailbox API:', error);
      return createErrorResponse(error, 'Internal server error', 200);
    }
});

// Helper function to log audit events
async function logAuditEvent(
  supabaseClient: any,
  data: LogAuditEventData,
  mailboxId: string,
  userId: string,
  req: Request
) {
  try {
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    
    let ip = 'unknown';
    if (forwardedFor) {
      ip = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      ip = realIp.trim();
    }
    
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const auditData: Database['public']['Tables']['audit_logs']['Insert'] = {
      tenant_id: data.tenant_id,
      mailbox_id: mailboxId,
      user_id: userId,
      action: 'mailbox_api_call',
      details: data.details || {},
      ip_address: ip
    };

    await supabaseClient.from('audit_logs').insert(auditData);
    console.log('Audit event logged successfully');
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}