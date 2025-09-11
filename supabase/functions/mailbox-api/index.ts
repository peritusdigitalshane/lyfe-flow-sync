import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      mailboxes: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          email_address: string;
          display_name: string;
          status: "pending" | "connected" | "error" | "paused";
          microsoft_graph_token: string | null;
          last_sync_at: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          email_address: string;
          display_name: string;
          status?: "pending" | "connected" | "error" | "paused";
          microsoft_graph_token?: string | null;
          last_sync_at?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "connected" | "error" | "paused";
          microsoft_graph_token?: string | null;
          last_sync_at?: string | null;
          error_message?: string | null;
          updated_at?: string;
        };
      };
      mailbox_configs: {
        Row: {
          id: string;
          mailbox_id: string;
          tenant_id: string;
          version: number;
          config: any;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          mailbox_id: string;
          tenant_id: string;
          version?: number;
          config: any;
          is_active?: boolean;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          tenant_id: string;
          mailbox_id: string | null;
          user_id: string | null;
          action: string;
          details: any | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          mailbox_id?: string | null;
          user_id?: string | null;
          action: string;
          details?: any | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
    };
  };
}

async function logAudit(
  supabase: any,
  tenantId: string,
  action: string,
  details: any,
  mailboxId?: string,
  userId?: string,
  req?: Request
) {
  try {
    // Handle multiple IPs in x-forwarded-for header by taking the first one
    const forwardedFor = req?.headers.get('x-forwarded-for');
    const realIp = req?.headers.get('x-real-ip');
    
    let ip = 'unknown';
    if (forwardedFor) {
      // Take the first IP from the comma-separated list and trim whitespace
      ip = forwardedFor.split(',')[0].trim();
    } else if (realIp) {
      ip = realIp.trim();
    }
    
    const userAgent = req?.headers.get('user-agent') || 'unknown';

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      mailbox_id: mailboxId,
      user_id: userId,
      action,
      details,
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
}

serve(async (req) => {
  console.log('Edge function called:', req.method, req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight');
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

    const supabaseClient = createClient<Database>(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    
    console.log('Request details:', { path, method, url: req.url });

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    console.log('Authorization header check:', {
      hasAuthHeader: !!authHeader,
      authHeaderLength: authHeader?.length || 0
    });

    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing authorization header',
          details: 'Authentication token required'
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
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Authentication failed',
          details: error.message || 'Failed to verify token'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to fetch user profile',
          details: error.message || 'Database error'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    const tenantId = profile.tenant_id;
    console.log('User authenticated:', { userId: user.id, tenantId });

    // Route handling
    console.log('Checking routes for:', path, method);
    if (path.includes('/mailbox-api') && method === 'POST') {
      console.log('Matched mailbox creation route');
      
      // Parse request body
      let body, emailAddress, displayName, preset;
      try {
        body = await req.json();
        emailAddress = body.emailAddress;
        displayName = body.displayName;
        preset = body.preset;
        
        console.log('Creating mailbox:', { emailAddress, displayName, preset });

        if (!emailAddress || !displayName) {
          console.error('Missing required fields:', { emailAddress: !!emailAddress, displayName: !!displayName });
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Missing required fields',
              details: 'Email address and display name are required'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (error) {
        console.error('Failed to parse request body:', error);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Invalid request body',
            details: error.message || 'Failed to parse JSON'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get Microsoft OAuth settings from database
      console.log('Fetching OAuth configuration...');
      let oauthConfig, oauthError;
      
      try {
        const result = await supabaseClient
          .from('app_settings')
          .select('value')
          .eq('key', 'microsoft_oauth')
          .single();
        
        oauthConfig = result.data;
        oauthError = result.error;
      } catch (error) {
        console.error('Failed to fetch OAuth config:', error);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Failed to fetch OAuth configuration',
            details: error.message || 'Database error'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('OAuth config result:', {
        hasConfig: !!oauthConfig,
        hasValue: !!oauthConfig?.value,
        error: oauthError?.message
      });

      let authUrl = "";
      if (oauthConfig?.value) {
        const config = oauthConfig.value as any;
        console.log('OAuth config details:', {
          hasClientId: !!config.client_id,
          hasClientSecret: !!config.client_secret,
          hasTenantId: !!config.tenant_id
        });

        if (config.client_id && config.client_secret) {
          // Use consistent redirect URI regardless of domain
          // Both lovable.app and lovableproject.com domains should work
          const refererHeader = req.headers.get('referer') || req.headers.get('origin');
          let origin;
          
          if (refererHeader) {
            try {
              const refererUrl = new URL(refererHeader);
              origin = refererUrl.origin;
              console.log('Using origin from referer:', origin);
            } catch (e) {
              console.log('Failed to parse referer, using fallback');
              origin = 'https://preview--lyfe-flow-sync.lovable.app'; // Default to lovable.app
            }
          } else {
            origin = 'https://preview--lyfe-flow-sync.lovable.app'; // Default to lovable.app
            console.log('No referer header, using default origin:', origin);
          }
          
          const redirectUri = `${origin}/auth/callback`;
          console.log('OAuth redirect URI:', redirectUri);
          
          authUrl = `https://login.microsoftonline.com/${config.tenant_id || 'common'}/oauth2/v2.0/authorize?` +
            `client_id=${encodeURIComponent(config.client_id)}&` +
            `response_type=code&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `scope=openid%20profile%20email%20User.Read%20Mail.ReadWrite%20MailboxSettings.ReadWrite%20offline_access&` +
            `prompt=consent&` +
            `state=${Date.now()}`;
          
          console.log('Generated OAuth URL:', authUrl);
        } else {
          console.log('Microsoft OAuth credentials incomplete');
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Microsoft OAuth not configured',
              details: 'Client ID and Client Secret are required'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.log('No OAuth config found');
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'OAuth configuration not found',
            details: 'Microsoft OAuth settings not configured'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle mailbox record creation or re-authentication
      let mailbox, dbError;
      
      if (preset === 'existing' && body.mailboxId) {
        // Re-authentication: find existing mailbox and set to pending
        console.log('Re-authentication: updating existing mailbox to pending');
        
        try {
          const result = await supabaseClient
            .from('mailboxes')
            .update({
              status: 'pending',
              error_message: null,
            })
            .eq('id', body.mailboxId)
            .eq('tenant_id', tenantId)
            .eq('user_id', user.id)
            .select()
            .single();

          mailbox = result.data;
          dbError = result.error;
          
          if (!mailbox) {
            console.error('Mailbox not found for re-authentication');
            return new Response(
              JSON.stringify({ 
                success: false,
                error: 'Mailbox not found',
                details: 'Could not find mailbox for re-authentication'
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          console.log('Mailbox updated for re-authentication:', mailbox.id);
        } catch (error) {
          console.error('Database update error:', error);
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Failed to update mailbox',
              details: error.message || 'Database update failed'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // New mailbox creation
        console.log('Creating new mailbox record...');
        
        try {
          const result = await supabaseClient
            .from('mailboxes')
            .insert({
              tenant_id: tenantId,
              user_id: user.id,
              email_address: emailAddress,
              display_name: displayName,
              status: 'pending',
            })
            .select()
            .single();

          mailbox = result.data;
          dbError = result.error;
        } catch (error) {
          console.error('Database insert error:', error);
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Failed to create mailbox',
              details: error.message || 'Database insert failed'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (dbError) {
          console.error('Mailbox creation failed:', dbError);
          return new Response(
            JSON.stringify({ 
              success: false,
              error: 'Failed to create mailbox',
              details: dbError.message || 'Database error'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Mailbox created successfully:', mailbox.id);
      }

      // Log audit trail
      try {
        const action = preset === 'existing' ? 'mailbox_reauth_initiated' : 'mailbox_created';
        await logAudit(supabaseClient, tenantId, action, {
          mailbox_id: mailbox.id,
          email_address: emailAddress,
          preset,
        }, mailbox.id, user.id, req);
      } catch (error) {
        console.error('Audit log failed (non-fatal):', error);
      }

      console.log('Returning success response');
      return new Response(
        JSON.stringify({
          success: true,
          mailbox,
          authUrl: authUrl,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle mailbox state changes (pause/resume)
    const stateMatch = path.match(/\/mailbox-api\/([^\/]+)\/state$/);
    if (stateMatch && method === 'PATCH') {
      console.log('Matched mailbox state change route');
      const mailboxId = stateMatch[1];
      
      let body, action;
      try {
        body = await req.json();
        action = body.action; // 'pause' or 'resume'
        console.log('Mailbox state change:', { mailboxId, action });
      } catch (error) {
        console.error('Failed to parse state change request:', error);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Invalid request body',
            details: error.message || 'Failed to parse JSON'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get mailbox
      let mailbox, mailboxError;
      try {
        const result = await supabaseClient
          .from('mailboxes')
          .select('*')
          .eq('id', mailboxId)
          .eq('tenant_id', tenantId)
          .single();
        
        mailbox = result.data;
        mailboxError = result.error;
      } catch (error) {
        console.error('Failed to fetch mailbox:', error);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Failed to fetch mailbox',
            details: error.message || 'Database error'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (mailboxError || !mailbox) {
        console.error('Mailbox not found:', mailboxError);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Mailbox not found',
            details: mailboxError?.message || 'Mailbox does not exist'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newStatus = action === 'pause' ? 'paused' : 'connected';
      
      // Update database directly (no n8n integration needed)

      // Update database
      try {
        await supabaseClient
          .from('mailboxes')
          .update({ status: newStatus })
          .eq('id', mailboxId);
      } catch (error) {
        console.error('Failed to update mailbox status:', error);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Failed to update mailbox status',
            details: error.message || 'Database update failed'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        await logAudit(supabaseClient, tenantId, action === 'pause' ? 'mailbox_paused' : 'mailbox_resumed', {
          mailbox_id: mailboxId,
        }, mailboxId, user.id, req);
      } catch (error) {
        console.error('Audit log failed (non-fatal):', error);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('No route matched, returning 404');
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Route not found',
        details: `No handler for ${method} ${path}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        details: error.message || 'Unknown error occurred'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});