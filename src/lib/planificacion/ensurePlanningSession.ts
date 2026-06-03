import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { isDemoBootstrapEnabled } from '@/lib/demoBootstrap';

const DEMO_TEACHER_EMAIL = 'demo.teacher@example.com';
const DEMO_TEACHER_PASSWORD = 'DemoPassword2026!';

/**
 * Ensures a Supabase auth user exists for plan creation.
 * Production: requires an existing session (ProtectedTeacherRoute).
 * Local dev only: may bootstrap demo teacher via edge function.
 */
export async function ensurePlanningSession(): Promise<{ user: User } | { error: string }> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!userError && user) {
    return { user };
  }

  if (!isDemoBootstrapEnabled()) {
    return {
      error: 'Tenés que iniciar sesión como docente antes de crear una planificación.',
    };
  }

  const { error: ensureError } = await supabase.functions.invoke('ensure-demo-users');
  if (ensureError && import.meta.env.DEV) {
    console.warn('[ensurePlanningSession] ensure-demo-users:', ensureError);
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: DEMO_TEACHER_EMAIL,
    password: DEMO_TEACHER_PASSWORD,
  });

  if (signInError) {
    return { error: `No se pudo autenticar: ${signInError.message}` };
  }

  await new Promise((resolve) => setTimeout(resolve, 500));

  const { data: { user: retryUser }, error: retryError } = await supabase.auth.getUser();
  if (retryError || !retryUser) {
    return {
      error: retryError?.message ?? 'No se pudo establecer la sesión de usuario.',
    };
  }

  return { user: retryUser };
}
