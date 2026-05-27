#!/usr/bin/env node
/**
 * Creates/updates demo Auth users (DOC001–005, DIR001) + profiles.
 * Prefers SUPABASE_SERVICE_ROLE_KEY (Dashboard → API). Falls back to ensure-demo-users edge.
 */
import { createClient } from '@supabase/supabase-js';
import { loadMergedEnv, repoRootFromImportMeta } from './lib/run-sql-seed.mjs';

const DEMO_TEACHER_PASSWORD = 'DemoPassword2026!';

const DEMO_TEACHERS = [
  { email: 'demo.teacher@example.com', displayName: 'María López', schoolId: 'liceo-demo', role: 'teacher' },
  { email: 'demo.teacher2@example.com', displayName: 'Carlos Rodríguez', schoolId: 'liceo-norte', role: 'teacher' },
  { email: 'demo.teacher3@example.com', displayName: 'Laura Fernández', schoolId: 'liceo-demo', role: 'teacher' },
  { email: 'demo.teacher4@example.com', displayName: 'Patricia Morales', schoolId: 'liceo-st-patricks', role: 'teacher' },
  { email: 'demo.teacher5@example.com', displayName: 'Miguel Torres', schoolId: 'liceo-st-patricks', role: 'teacher' },
  {
    email: 'direccion.demo@example.com',
    displayName: 'Ana Martínez (Dirección)',
    schoolId: 'liceo-demo',
    role: 'direccion',
  },
];

async function ensureViaServiceRole(env) {
  const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return false;

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: listData, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw new Error(listError.message);

  const usersByEmail = new Map(
    listData.users.map((u) => [(u.email || '').toLowerCase(), u.id])
  );

  const ensured = [];

  for (const teacher of DEMO_TEACHERS) {
    const emailKey = teacher.email.toLowerCase();
    let userId = usersByEmail.get(emailKey);

    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: teacher.email,
        password: DEMO_TEACHER_PASSWORD,
        email_confirm: true,
        user_metadata: { role: teacher.role, display_name: teacher.displayName },
      });
      if (createError) throw new Error(`create ${teacher.email}: ${createError.message}`);
      userId = created.user?.id;
    } else {
      const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
        password: DEMO_TEACHER_PASSWORD,
        user_metadata: { role: teacher.role, display_name: teacher.displayName },
      });
      if (updateError) throw new Error(`update ${teacher.email}: ${updateError.message}`);
    }

    if (!userId) throw new Error(`missing user id for ${teacher.email}`);

    const { data: profile } = await admin
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!profile) {
      const { error: insErr } = await admin.from('profiles').insert({
        user_id: userId,
        display_name: teacher.displayName,
        role: teacher.role,
        school_id: teacher.schoolId,
      });
      if (insErr) console.warn('[seed:auth-users] profile insert', teacher.email, insErr.message);
    } else {
      await admin
        .from('profiles')
        .update({
          display_name: teacher.displayName,
          role: teacher.role,
          school_id: teacher.schoolId,
        })
        .eq('user_id', userId);
    }

    ensured.push(teacher.email);
  }

  console.log('[seed:auth-users] OK (service role)', ensured.join(', '));
  return true;
}

async function ensureViaEdgeFunction(env) {
  const baseUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const anonKey = env.VITE_SUPABASE_ANON_KEY || '';
  const bootstrapSecret = env.DEMO_BOOTSTRAP_SECRET || '';
  if (!baseUrl || !anonKey) return false;

  const headers = {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
  if (bootstrapSecret) headers['x-demo-bootstrap-secret'] = bootstrapSecret;

  const res = await fetch(`${baseUrl}/functions/v1/ensure-demo-users`, {
    method: 'POST',
    headers,
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    console.warn('[seed:auth-users] edge function', res.status, body);
    return false;
  }

  console.log('[seed:auth-users] OK (edge)', body);
  return true;
}

const root = repoRootFromImportMeta(import.meta.url);
const env = loadMergedEnv(root);

try {
  const viaAdmin = await ensureViaServiceRole(env);
  if (!viaAdmin) {
    const viaEdge = await ensureViaEdgeFunction(env);
    if (!viaEdge) {
      console.error(
        '[seed:auth-users] No se pudieron crear usuarios demo.\n\n' +
          'Opción A — agregá a .env la service role key (recomendado para seeds):\n' +
          '  Supabase Dashboard → Settings → API → service_role\n' +
          '  SUPABASE_SERVICE_ROLE_KEY=<clave>\n\n' +
          'Opción B — secreto + función desplegada:\n' +
          '  npx supabase secrets set DEMO_BOOTSTRAP_SECRET=<valor>\n' +
          '  DEMO_BOOTSTRAP_SECRET=<mismo> en .env\n' +
          '  npx supabase functions deploy ensure-demo-users --project-ref bbzikjvrehfooaumkmui\n\n' +
          'Opción C — Dashboard → Authentication → Add user:\n' +
          '  direccion.demo@example.com / DemoPassword2026!\n' +
          '  Luego: npm run seed:login'
      );
      process.exit(1);
    }
  }
} catch (e) {
  console.error('[seed:auth-users]', e?.message || e);
  process.exit(1);
}
