import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  password: string;
  fullName?: string;
  role?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Parse request body
    const { email, password, fullName, role }: CreateUserRequest = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Creating user: ${email}`);

    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName || '',
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!authUser.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`User created successfully: ${authUser.user.id}`);

    // The profile will be created automatically by the handle_new_user trigger
    // Wait a moment for the trigger to execute
    await new Promise(resolve => setTimeout(resolve, 1000));

    // If a role is specified, assign it
    if (role && role !== 'user') {
      console.log(`Assigning role ${role} to user ${authUser.user.id}`);
      
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: authUser.user.id,
          role: role,
          created_by: authUser.user.id // The new user is created by admin, but we'll use the user's own ID
        });

      if (roleError) {
        console.error('Role assignment error:', roleError);
        // Don't fail the entire operation if role assignment fails
        // The user is still created successfully
        return new Response(
          JSON.stringify({ 
            success: true,
            user: {
              id: authUser.user.id,
              email: authUser.user.email,
              full_name: fullName
            },
            warning: `User created successfully but role assignment failed: ${roleError.message}`
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    console.log('User creation completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        user: {
          id: authUser.user.id,
          email: authUser.user.email,
          full_name: fullName
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error creating user:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create user' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});