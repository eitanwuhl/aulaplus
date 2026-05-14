-- Idempotent demo rows for login (teacher code → email; student bcrypt).
-- Re-run anytime: npm run seed:login
-- Teacher Auth user must exist (password): deploy/run ensure-demo-users Edge Function.

INSERT INTO public.demo_teacher_credentials (login_code, auth_email)
VALUES ('DOC001', 'demo.teacher@example.com')
ON CONFLICT (login_code) DO UPDATE
SET auth_email = excluded.auth_email;

INSERT INTO public.student_accounts (student_code, password_hash, display_name)
VALUES (
  'EST2024001',
  extensions.crypt('EstudianteDemo2024!', extensions.gen_salt('bf')),
  'Estudiante Demo'
)
ON CONFLICT (student_code) DO UPDATE
SET
  password_hash = excluded.password_hash,
  display_name = excluded.display_name;
