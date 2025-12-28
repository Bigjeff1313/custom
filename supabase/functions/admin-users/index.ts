import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { action, userId, email, password, role } = await req.json();
    
    console.log(`Admin Users API called: action=${action}`);

    switch (action) {
      case 'list-users': {
        // Get all users from auth
        const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (authError) {
          throw authError;
        }

        // Get all user roles
        const { data: rolesData, error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .select('*');
        
        if (rolesError) {
          throw rolesError;
        }

        // Map roles to users
        const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);
        
        const users = authUsers.users.map(user => ({
          id: user.id,
          email: user.email || 'No email',
          created_at: user.created_at,
          role: rolesMap.get(user.id) || null,
        }));

        console.log(`Found ${users.length} users`);

        return new Response(JSON.stringify({ success: true, users }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create-user': {
        // Create new user
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

        if (createError) {
          throw createError;
        }

        // Assign role if specified
        if (role && newUser.user) {
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
              user_id: newUser.user.id,
              role: role,
            });
          
          if (roleError) {
            console.error('Failed to assign role:', roleError);
          }
        }

        console.log(`Created user: ${email}`);

        return new Response(JSON.stringify({ success: true, user: newUser.user }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update-role': {
        // Update or insert user role
        const { data: existingRole } = await supabaseAdmin
          .from('user_roles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (existingRole) {
          const { error } = await supabaseAdmin
            .from('user_roles')
            .update({ role })
            .eq('user_id', userId);
          
          if (error) throw error;
        } else {
          const { error } = await supabaseAdmin
            .from('user_roles')
            .insert({ user_id: userId, role });
          
          if (error) throw error;
        }

        console.log(`Updated role for user ${userId} to ${role}`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete-user': {
        // Delete user role first
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userId);

        // Delete the user
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        
        if (deleteError) {
          throw deleteError;
        }

        console.log(`Deleted user: ${userId}`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Admin Users API error:', errorMessage);

    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
