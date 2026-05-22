-- Multi-tenant foundation: one row per liceo (school). Catalog + profiles scoped by school_id.

CREATE TABLE IF NOT EXISTS public.schools (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.schools IS 'Tenant root (liceo / institución). All school-scoped catalog rows reference schools.id.';

INSERT INTO public.schools (id, name, slug)
VALUES
  ('liceo-demo', 'Liceo Demo Aula+', 'liceo-demo'),
  ('liceo-norte', 'Liceo Secundario del Norte', 'liceo-norte')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug;

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users select schools" ON public.schools;
CREATE POLICY "Authenticated users select schools"
  ON public.schools
  FOR SELECT
  TO authenticated
  USING (true);

-- ── school_groups: add tenant column, composite PK (school_id, id) ──

ALTER TABLE public.school_groups
  ADD COLUMN IF NOT EXISTS school_id text;

UPDATE public.school_groups
SET school_id = 'liceo-demo'
WHERE school_id IS NULL;

ALTER TABLE public.school_groups
  ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE public.school_groups
  DROP CONSTRAINT IF EXISTS school_groups_school_id_fkey;

ALTER TABLE public.school_groups
  ADD CONSTRAINT school_groups_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES public.schools (id) ON DELETE RESTRICT;

-- FKs that reference school_groups(id) must drop before PK becomes (school_id, id).
ALTER TABLE public.dashboard_notifications
  DROP CONSTRAINT IF EXISTS dashboard_notifications_group_id_fkey;

ALTER TABLE public.school_students
  DROP CONSTRAINT IF EXISTS school_students_school_group_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.school_groups'::regclass
      AND contype = 'p'
      AND conname = 'school_groups_pkey'
      AND array_length(conkey, 1) = 1
  ) THEN
    ALTER TABLE public.school_groups DROP CONSTRAINT school_groups_pkey;
    ALTER TABLE public.school_groups ADD PRIMARY KEY (school_id, id);
  END IF;
END $$;

-- ── school_students: tenant column + composite FK to catalog group ──

ALTER TABLE public.school_students
  ADD COLUMN IF NOT EXISTS school_id text;

UPDATE public.school_students ss
SET school_id = sg.school_id
FROM public.school_groups sg
WHERE sg.id = ss.school_group_id
  AND ss.school_id IS NULL;

ALTER TABLE public.school_students
  ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE public.school_students
  ADD CONSTRAINT school_students_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES public.schools (id) ON DELETE RESTRICT;

ALTER TABLE public.school_students
  ADD CONSTRAINT school_students_school_group_fkey
  FOREIGN KEY (school_id, school_group_id)
  REFERENCES public.school_groups (school_id, id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_school_students_school
  ON public.school_students (school_id);

CREATE INDEX IF NOT EXISTS idx_school_groups_school
  ON public.school_groups (school_id);

-- ── dashboard_notifications: tenant-aware group targets ──

ALTER TABLE public.dashboard_notifications
  ADD COLUMN IF NOT EXISTS school_id text;

UPDATE public.dashboard_notifications dn
SET school_id = sg.school_id
FROM public.school_groups sg
WHERE dn.group_id IS NOT NULL
  AND dn.group_id = sg.id
  AND dn.school_id IS NULL;

UPDATE public.dashboard_notifications dn
SET school_id = ss.school_id
FROM public.school_students ss
WHERE dn.student_id IS NOT NULL
  AND dn.student_id = ss.id
  AND dn.school_id IS NULL;

ALTER TABLE public.dashboard_notifications
  DROP CONSTRAINT IF EXISTS dashboard_notifications_school_id_fkey;

ALTER TABLE public.dashboard_notifications
  ADD CONSTRAINT dashboard_notifications_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES public.schools (id) ON DELETE SET NULL;

ALTER TABLE public.dashboard_notifications
  DROP CONSTRAINT IF EXISTS dashboard_notifications_group_fkey;

ALTER TABLE public.dashboard_notifications
  ADD CONSTRAINT dashboard_notifications_group_fkey
  FOREIGN KEY (school_id, group_id)
  REFERENCES public.school_groups (school_id, id)
  ON DELETE SET NULL;

ALTER TABLE public.dashboard_notifications
  DROP CONSTRAINT IF EXISTS dashboard_notifications_student_id_fkey;

ALTER TABLE public.dashboard_notifications
  ADD CONSTRAINT dashboard_notifications_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.school_students (id) ON DELETE SET NULL;

-- ── profiles: each teacher belongs to one school (v1) ──

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS school_id text;

UPDATE public.profiles
SET school_id = 'liceo-demo'
WHERE school_id IS NULL
  AND COALESCE(role, '') IN ('teacher', 'direccion', 'psicopedagogico');

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES public.schools (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON public.profiles (school_id);

-- ── Helpers for RLS ──

CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.school_id
  FROM public.profiles pr
  WHERE pr.user_id = auth.uid()
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_user_school_id IS
  'Tenant id (schools.id) for the authenticated user profile. NULL if missing profile/school.';

-- ── RLS: catalog visible only within tenant ──

DROP POLICY IF EXISTS "Teachers select school_groups" ON public.school_groups;
CREATE POLICY "Teachers select own school_groups"
  ON public.school_groups
  FOR SELECT
  TO authenticated
  USING (
    public.profile_role_is_teacher()
    AND school_id = public.current_user_school_id()
  );

DROP POLICY IF EXISTS "Teachers select school_students" ON public.school_students;
CREATE POLICY "Teachers select own school_students"
  ON public.school_students
  FOR SELECT
  TO authenticated
  USING (
    public.profile_role_is_teacher()
    AND school_id = public.current_user_school_id()
  );

-- ── Notifications: only targets in teacher tenant ──

DROP POLICY IF EXISTS "Teachers select visible dashboard_notifications" ON public.dashboard_notifications;

CREATE POLICY "Teachers select visible dashboard_notifications"
  ON public.dashboard_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.user_id = auth.uid()
        AND COALESCE(pr.role, '') = 'teacher'
    )
    AND (
      recipient_user_id = auth.uid()
      OR (
        recipient_user_id IS NULL
        AND (
          (student_id IS NULL AND group_id IS NULL)
          OR (
            group_id IS NOT NULL
            AND student_id IS NULL
            AND EXISTS (
              SELECT 1
              FROM public.grupos g
              INNER JOIN public.school_groups sg
                ON sg.id = g.id AND sg.school_id = public.current_user_school_id()
              WHERE g.id = dashboard_notifications.group_id
                AND g.user_id = auth.uid()
            )
          )
          OR (
            student_id IS NOT NULL
            AND group_id IS NULL
            AND EXISTS (
              SELECT 1
              FROM public.school_students ss
              INNER JOIN public.grupos g
                ON g.id = ss.school_group_id AND g.user_id = auth.uid()
              WHERE ss.id = dashboard_notifications.student_id
                AND ss.school_id = public.current_user_school_id()
            )
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "Teachers insert broadcast dashboard_notifications" ON public.dashboard_notifications;

CREATE POLICY "Teachers insert broadcast dashboard_notifications"
  ON public.dashboard_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND recipient_user_id IS NULL
    AND notification_type IN ('info', 'urgent')
    AND (
      (student_id IS NULL AND group_id IS NULL)
      OR (
        group_id IS NOT NULL
        AND student_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.grupos g
          INNER JOIN public.school_groups sg
            ON sg.id = g.id AND sg.school_id = public.current_user_school_id()
          WHERE g.id = group_id
            AND g.user_id = auth.uid()
        )
      )
      OR (
        student_id IS NOT NULL
        AND group_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.school_students ss
          INNER JOIN public.grupos g
            ON g.id = ss.school_group_id AND g.user_id = auth.uid()
          WHERE ss.id = student_id
            AND ss.school_id = public.current_user_school_id()
        )
      )
    )
  );

-- Second tenant catalog (minimal demo for liceo-norte)
INSERT INTO public.school_groups (school_id, id, name, year, section)
VALUES
  ('liceo-norte', '1', '8vo 1', '8º Año', '1'),
  ('liceo-norte', '2', '8vo 2', '8º Año', '2')
ON CONFLICT (school_id, id) DO UPDATE SET
  name = EXCLUDED.name,
  year = EXCLUDED.year,
  section = EXCLUDED.section;

INSERT INTO public.school_students (id, school_id, school_group_id, display_name, perfil)
VALUES
  (201, 'liceo-norte', '1', 'Renata Pérez', 'Visual-Kinestésico'),
  (202, 'liceo-norte', '1', 'Tomás Acosta', 'Auditivo-Lector/escritor'),
  (203, 'liceo-norte', '2', 'Emilia Ruiz', 'Kinestésico-Visual'),
  (204, 'liceo-norte', '2', 'Benjamín Costa', 'Lector/escritor-Auditivo')
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  school_group_id = EXCLUDED.school_group_id,
  display_name = EXCLUDED.display_name,
  perfil = EXCLUDED.perfil;

-- Demo teachers → tenant (DOC002 = liceo-norte; resto = liceo-demo)
UPDATE public.profiles p
SET school_id = 'liceo-norte'
FROM auth.users u
WHERE p.user_id = u.id
  AND lower(u.email) = 'demo.teacher2@example.com';

UPDATE public.profiles p
SET school_id = 'liceo-demo'
FROM auth.users u
WHERE p.user_id = u.id
  AND lower(u.email) IN (
    'demo.teacher@example.com',
    'demo.teacher3@example.com'
  );
