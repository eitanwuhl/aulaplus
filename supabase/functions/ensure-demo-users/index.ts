import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-demo-bootstrap-secret',
};

function isLocalSupabaseHost(url: string): boolean {
  return url.includes('127.0.0.1') || url.includes('localhost');
}

/** Hosted projects: require DEMO_BOOTSTRAP_SECRET header. Local Supabase: open for dev. */
function assertBootstrapAuthorized(req: Request): Response | null {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  if (isLocalSupabaseHost(supabaseUrl)) {
    return null;
  }

  const secret = Deno.env.get('DEMO_BOOTSTRAP_SECRET');
  if (!secret) {
    return new Response(
      JSON.stringify({
        error: 'Demo bootstrap disabled',
        details:
          'On hosted Supabase, set DEMO_BOOTSTRAP_SECRET and call with header x-demo-bootstrap-secret, or use npm run seed:login.',
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (req.headers.get('x-demo-bootstrap-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return null;
}

const DEMO_TEACHER_PASSWORD = 'DemoPassword2026!';

/** Keep in sync with src/lib/multitenancy/demoTenantManifest.ts and supabase/seeds/login_demo.sql */
const DEMO_TEACHERS = [
  {
    email: 'demo.teacher@example.com',
    displayName: 'María López',
    schoolId: 'liceo-demo',
  },
  {
    email: 'demo.teacher2@example.com',
    displayName: 'Carlos Rodríguez',
    schoolId: 'liceo-norte',
  },
  {
    email: 'demo.teacher3@example.com',
    displayName: 'Laura Fernández',
    schoolId: 'liceo-demo',
  },
  {
    email: 'demo.teacher4@example.com',
    displayName: 'Patricia Morales',
    schoolId: 'liceo-st-patricks',
  },
  {
    email: 'demo.teacher5@example.com',
    displayName: 'Miguel Torres',
    schoolId: 'liceo-st-patricks',
  },
] as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authDenied = assertBootstrapAuthorized(req);
  if (authDenied) {
    return authDenied;
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          error: 'Missing Supabase configuration',
          details:
            'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (local) or SERVICE_ROLE_KEY (custom secret) are required.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listError) {
      return new Response(
        JSON.stringify({ error: 'Failed to list users', details: listError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const usersByEmail = new Map(
      listData.users.map((u: { id: string; email?: string }) => [
        (u.email || '').toLowerCase(),
        u.id,
      ]),
    );

    const ensured: string[] = [];

    for (const teacher of DEMO_TEACHERS) {
      const emailKey = teacher.email.toLowerCase();
      let userId = usersByEmail.get(emailKey);

      if (!userId) {
        const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: teacher.email,
          password: DEMO_TEACHER_PASSWORD,
          email_confirm: true,
          user_metadata: { role: 'teacher', display_name: teacher.displayName },
        });
        if (createError) {
          return new Response(
            JSON.stringify({
              error: `Failed to create ${teacher.email}`,
              details: createError.message,
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
        userId = created.user?.id;
      } else {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: DEMO_TEACHER_PASSWORD,
          user_metadata: { role: 'teacher', display_name: teacher.displayName },
        });
        if (updateError) {
          return new Response(
            JSON.stringify({
              error: `Failed to update ${teacher.email}`,
              details: updateError.message,
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Demo teacher user missing', details: teacher.email }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile) {
        const { error: profileInsertError } = await supabaseAdmin.from('profiles').insert({
          user_id: userId,
          display_name: teacher.displayName,
          role: 'teacher',
          school_id: teacher.schoolId,
        });
        if (profileInsertError) {
          console.error('Error creating profile:', profileInsertError);
        }
      } else {
        await supabaseAdmin
          .from('profiles')
          .update({
            display_name: teacher.displayName,
            role: 'teacher',
            school_id: teacher.schoolId,
          })
          .eq('user_id', userId);
      }

      ensured.push(teacher.email);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Demo teachers ensured',
        teachers: ensured,
        password: DEMO_TEACHER_PASSWORD,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
