-- Demo login: teacher codes → auth email; student codes → bcrypt password.
-- Password docentes: DemoPassword2024!
-- Password estudiantes: EstudianteDemo2024!
-- Auth users (docentes): deploy + invoke ensure-demo-users (crea los 3 profesores en auth.users).
-- Re-run: npm run seed:login

INSERT INTO public.demo_teacher_credentials (login_code, auth_email)
VALUES
  ('DOC001', 'demo.teacher@example.com'),
  ('DOC002', 'demo.teacher2@example.com'),
  ('DOC003', 'demo.teacher3@example.com'),
  ('DOC004', 'demo.teacher4@example.com'),
  ('DOC005', 'demo.teacher5@example.com')
ON CONFLICT (login_code) DO UPDATE
SET auth_email = EXCLUDED.auth_email;

INSERT INTO public.student_accounts (student_code, password_hash, display_name, catalog_student_id)
VALUES
  (
    'EST2024001',
    extensions.crypt('EstudianteDemo2024!', extensions.gen_salt('bf')),
    'Ana García (9no 1)',
    1
  ),
  (
    'EST2024002',
    extensions.crypt('EstudianteDemo2024!', extensions.gen_salt('bf')),
    'Carlos López (9no 1)',
    2
  ),
  (
    'EST2024003',
    extensions.crypt('EstudianteDemo2024!', extensions.gen_salt('bf')),
    'Sofía Fernández (9no 2)',
    5
  ),
  (
    'EST2024004',
    extensions.crypt('EstudianteDemo2024!', extensions.gen_salt('bf')),
    'Valentina Castro (9no 2)',
    7
  ),
  (
    'EST2024005',
    extensions.crypt('EstudianteDemo2024!', extensions.gen_salt('bf')),
    'Isabella Morales (9no 3)',
    9
  ),
  (
    'EST2024006',
    extensions.crypt('EstudianteDemo2024!', extensions.gen_salt('bf')),
    'Luciano Vega (9no 3)',
    10
  )
ON CONFLICT (student_code) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  display_name = EXCLUDED.display_name,
  catalog_student_id = EXCLUDED.catalog_student_id;
