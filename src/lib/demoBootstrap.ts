/**
 * Client-side demo bootstrap (ensure-demo-users).
 * Solo en Supabase local: en la nube usar `npm run seed:auth-users` con service role.
 */

function supabaseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL || '').trim();
}

export function isLocalSupabaseUrl(url = supabaseUrl()): boolean {
  return url.includes('127.0.0.1') || url.includes('localhost');
}

/** True when the browser may invoke ensure-demo-users (local dev only). */
export function isDemoBootstrapEnabled(): boolean {
  return import.meta.env.DEV && isLocalSupabaseUrl();
}

const DEMO_TEACHER_EMAILS = new Set([
  'demo.teacher@example.com',
  'demo.teacher2@example.com',
  'demo.teacher3@example.com',
  'demo.teacher4@example.com',
  'demo.teacher5@example.com',
  'direccion.demo@example.com',
]);

export function isDemoTeacherEmail(email: string): boolean {
  return DEMO_TEACHER_EMAILS.has(email.toLowerCase());
}

export function demoTeacherLoginHints(): string {
  const remote = !isLocalSupabaseUrl();
  const parts = [
    'Códigos demo: DOC001–DOC005, DIR001 — contraseña DemoPassword2026!.',
  ];
  if (remote) {
    parts.push(
      'Proyecto en la nube: ejecutá `npm run seed:auth-users` (con SUPABASE_SERVICE_ROLE_KEY en .env) y `npm run seed:login`.',
    );
  } else {
    parts.push('En local: `npm run seed:login` y `npm run functions:local`.');
  }
  return parts.join(' ');
}

export function demoStudentLoginHints(): string {
  return 'Estudiantes demo: EST2024001–EST2024006, contraseña EstudianteDemo2026!. En local: `npm run seed:login`.';
}
