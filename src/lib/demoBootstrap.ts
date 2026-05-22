/**
 * Client-side demo bootstrap (ensure-demo-users). Disabled in production builds.
 */

/** True when the app may invoke ensure-demo-users from the browser. */
export function isDemoBootstrapEnabled(): boolean {
  return import.meta.env.DEV;
}

export function isDemoTeacherEmail(email: string): boolean {
  return email.toLowerCase().includes('demo.teacher');
}

export function demoTeacherLoginHints(ensureError?: string): string {
  const parts: string[] = [];
  if (ensureError) parts.push(ensureError);
  parts.push(
    'Docentes demo: DOC001–DOC005 con contraseña DemoPassword2024!.',
    'En local: `npm run seed:login` y `npm run functions:local`.',
  );
  return parts.join(' ');
}

export function demoStudentLoginHints(): string {
  return 'Estudiantes demo: EST2024001–EST2024006, contraseña EstudianteDemo2024!. En local: `npm run seed:login`.';
}
