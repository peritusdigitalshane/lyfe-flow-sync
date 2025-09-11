import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImpersonateRequest {
  targetUserId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header to verify the requesting user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the requesting user's token and get their user data
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if the requesting user has super_admin role
    const { data: userRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)

    if (roleError) {
      console.error('Error fetching user roles:', roleError)
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const isSuperAdmin = userRoles?.some(r => r.role === 'super_admin')
    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Super admin role required.' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse the request body
    const { targetUserId }: ImpersonateRequest = await req.json()

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Target user ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Fetch the target user's profile data
    const { data: targetProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, tenant_id, created_at')
      .eq('id', targetUserId)
      .single()

    if (profileError || !targetProfile) {
      console.error('Error fetching target user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Target user not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Log the impersonation action for audit purposes
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'user_impersonation',
        tenant_id: targetProfile.tenant_id,
        details: {
          impersonated_user_id: targetUserId,
          impersonated_user_email: targetProfile.email,
          timestamp: new Date().toISOString()
        }
      })

    console.log(`Super admin ${user.email} is impersonating user ${targetProfile.email}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        targetUser: targetProfile,
        message: `Successfully retrieved data for impersonation of ${targetProfile.email}`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error in impersonate-user function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})