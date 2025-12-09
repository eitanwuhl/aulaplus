import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    // Note: Using SERVICE_ROLE_KEY instead of SUPABASE_SERVICE_ROLE_KEY
    // because Supabase reserves the SUPABASE_* prefix for system secrets
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY')!;
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Demo user credentials
    const demoTeacherEmail = 'demo.teacher@example.com';
    const demoTeacherPassword = 'DemoPassword2024!';

    console.log('Ensuring demo teacher user exists...');

    // Find existing user by listing users (getUserByEmail not available in v2 web)
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(
        JSON.stringify({ error: 'Failed to list users', details: listError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingUser = listData.users.find((u: any) => (u.email || '').toLowerCase() === demoTeacherEmail.toLowerCase());
    let userId: string | undefined = existingUser?.id;

    if (!userId) {
      console.log('Creating new demo teacher user...');
      // Create user with admin API (bypasses email confirmation)
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: demoTeacherEmail,
        password: demoTeacherPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          role: 'teacher',
          display_name: 'Profesor Demo'
        }
      });

      if (createError) {
        console.error('Error creating demo user:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create demo user', details: createError.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      userId = created.user?.id;
      console.log('Demo teacher user created successfully:', userId);
    } else {
      console.log('Demo teacher user already exists:', userId, ' - ensuring password and metadata');
      // Ensure password and metadata are set so password login works
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: demoTeacherPassword,
        user_metadata: {
          role: 'teacher',
          display_name: 'Profesor Demo'
        }
      });
      if (updateError) {
        console.error('Error updating demo user:', updateError);
      }
    }

    if (userId) {
      // Ensure profile exists/updated
      const { data: profileData, error: profileCheckError } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileCheckError) {
        console.error('Error checking profile:', profileCheckError);
      } else if (!profileData) {
        const { error: profileInsertError } = await supabaseAdmin
          .from('profiles')
          .insert({
            user_id: userId,
            display_name: 'Profesor Demo',
            role: 'teacher'
          });
        if (profileInsertError) {
          console.error('Error creating profile:', profileInsertError);
        } else {
          console.log('Profile created successfully');
        }
      } else {
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({
            display_name: 'Profesor Demo',
            role: 'teacher'
          })
          .eq('user_id', userId);
        if (profileUpdateError) {
          console.error('Error updating profile:', profileUpdateError);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Demo users ensured' }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});