-- Institutional catalog for groups/students (seeded from former mockData).
-- dashboard_notifications.student_id / group_id reference these tables (backend validation via FK).

CREATE TABLE IF NOT EXISTS public.school_groups (
  id text PRIMARY KEY,
  name text NOT NULL,
  year text,
  section text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.school_groups IS 'School group catalog (e.g. 9no 1). Distinct from per-teacher public.grupos.';

CREATE TABLE IF NOT EXISTS public.school_students (
  id integer PRIMARY KEY,
  school_group_id text NOT NULL REFERENCES public.school_groups (id) ON DELETE RESTRICT,
  display_name text NOT NULL,
  perfil text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.school_students IS 'Student catalog for teacher workflows; ids align with legacy mock student ids.';

CREATE INDEX IF NOT EXISTS idx_school_students_group ON public.school_students (school_group_id);

ALTER TABLE public.school_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers select school_groups" ON public.school_groups;
CREATE POLICY "Teachers select school_groups"
  ON public.school_groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.user_id = auth.uid()
        AND COALESCE(pr.role, '') = 'teacher'
    )
  );

DROP POLICY IF EXISTS "Teachers select school_students" ON public.school_students;
CREATE POLICY "Teachers select school_students"
  ON public.school_students
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.user_id = auth.uid()
        AND COALESCE(pr.role, '') = 'teacher'
    )
  );

-- Seed catalog (idempotent; same rows as supabase/seeds/school_catalog_demo.sql)
INSERT INTO public.school_groups (id, name, year, section)
VALUES
  ('1', '9no 1', '9º Año', '1'),
  ('2', '9no 2', '9º Año', '2'),
  ('3', '9no 3', '9º Año', '3')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  year = EXCLUDED.year,
  section = EXCLUDED.section;

INSERT INTO public.school_students (id, school_group_id, display_name, perfil)
VALUES
  (1, '1', 'Ana García', 'Visual-Kinestésico'),
  (2, '1', 'Carlos López', 'Auditivo-Lector/escritor'),
  (3, '1', 'María Rodríguez', 'Visual-Lector/escritor'),
  (4, '1', 'Diego Martínez', 'Kinestésico-Visual'),
  (5, '1', 'Sofía Fernández', 'Lector/escritor-Auditivo'),
  (6, '1', 'Joaquín Torres', 'Auditivo-Kinestésico'),
  (7, '1', 'Valentina Castro', 'Visual-Auditivo'),
  (8, '1', 'Mateo Silva', 'Kinestésico-Lector/escritor'),
  (9, '1', 'Isabella Morales', 'Visual-Lector/escritor'),
  (10, '1', 'Luciano Vega', 'Auditivo-Visual')
ON CONFLICT (id) DO UPDATE SET
  school_group_id = EXCLUDED.school_group_id,
  display_name = EXCLUDED.display_name,
  perfil = EXCLUDED.perfil;

-- Legacy/test rows may reference IDs outside the catalog; clear link instead of blocking FK creation.
UPDATE public.dashboard_notifications dn
SET student_id = NULL
WHERE dn.student_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.school_students ss
    WHERE ss.id = dn.student_id
  );

UPDATE public.dashboard_notifications dn
SET group_id = NULL
WHERE dn.group_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.school_groups sg
    WHERE sg.id = dn.group_id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dashboard_notifications_group_id_fkey'
      AND conrelid = 'public.dashboard_notifications'::regclass
  ) THEN
    ALTER TABLE public.dashboard_notifications
      ADD CONSTRAINT dashboard_notifications_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES public.school_groups (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dashboard_notifications_student_id_fkey'
      AND conrelid = 'public.dashboard_notifications'::regclass
  ) THEN
    ALTER TABLE public.dashboard_notifications
      ADD CONSTRAINT dashboard_notifications_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.school_students (id) ON DELETE SET NULL;
  END IF;
END $$;
