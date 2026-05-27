-- Module 1: Institutional configuration (product doc v2.0 — PILOTO scope)
-- Extends schools (tenant) with settings, curriculum frameworks, generic catalog, group-level marco.

-- ── Curriculum framework enum (10 marcos) ──
DO $$ BEGIN
  CREATE TYPE public.curriculum_framework AS ENUM (
    'anep_ebi',
    'anep_bach',
    'cambridge_primary',
    'cambridge_lower',
    'cambridge_igcse',
    'cambridge_al',
    'ib_pyp',
    'ib_myp',
    'ib_dp',
    'ib_cp'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.catalog_status AS ENUM ('borrador', 'activa', 'deprecada');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.catalog_item_type AS ENUM (
    'competencia_general',
    'espacio_curricular',
    'materia',
    'tramo',
    'contenido',
    'progresion',
    'learning_objective',
    'strand',
    'criterio',
    'descriptor',
    'key_concept',
    'global_context',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Institution settings on schools (Paso 1 onboarding) ──
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS institution_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.schools.institution_settings IS
  'Module 1: niveles_ofrecidos, idiomas, ciclo lectivo, periodos_evaluacion, habilitacion_anep por nivel, logo_url, etc.';

-- ── Active frameworks per school (institucion_marco) ──
CREATE TABLE IF NOT EXISTS public.school_curriculum_frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.schools (id) ON DELETE CASCADE,
  framework public.curriculum_framework NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  fecha_activacion date NOT NULL DEFAULT CURRENT_DATE,
  configuracion jsonb NOT NULL DEFAULT '{}'::jsonb,
  catalog_id uuid,
  idioma_generacion text NOT NULL DEFAULT 'es',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, framework)
);

CREATE INDEX IF NOT EXISTS idx_school_curriculum_frameworks_school
  ON public.school_curriculum_frameworks (school_id);

-- ── Generic curriculum catalog (catalogo_marco) ──
CREATE TABLE IF NOT EXISTS public.curriculum_catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  framework public.curriculum_framework NOT NULL,
  nombre text NOT NULL,
  version text NOT NULL DEFAULT '1.0',
  vigente_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta date,
  estado public.catalog_status NOT NULL DEFAULT 'borrador',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  school_id text REFERENCES public.schools (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.curriculum_catalogs.school_id IS
  'NULL = catálogo global pre-cargado Aula+; set = catálogo propio del liceo.';

CREATE INDEX IF NOT EXISTS idx_curriculum_catalogs_framework
  ON public.curriculum_catalogs (framework, estado);

-- Link school_curriculum_frameworks → catalog
ALTER TABLE public.school_curriculum_frameworks
  DROP CONSTRAINT IF EXISTS school_curriculum_frameworks_catalog_id_fkey;

ALTER TABLE public.school_curriculum_frameworks
  ADD CONSTRAINT school_curriculum_frameworks_catalog_id_fkey
  FOREIGN KEY (catalog_id) REFERENCES public.curriculum_catalogs (id) ON DELETE SET NULL;

-- ── Catalog items (catalogo_item) ──
CREATE TABLE IF NOT EXISTS public.curriculum_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid NOT NULL REFERENCES public.curriculum_catalogs (id) ON DELETE CASCADE,
  tipo public.catalog_item_type NOT NULL,
  codigo text,
  nombre text NOT NULL,
  descripcion text,
  nivel text,
  materia text,
  parent_id uuid REFERENCES public.curriculum_catalog_items (id) ON DELETE CASCADE,
  orden integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_catalog_items_catalog
  ON public.curriculum_catalog_items (catalog_id);

CREATE INDEX IF NOT EXISTS idx_curriculum_catalog_items_parent
  ON public.curriculum_catalog_items (parent_id);

-- ── Group-level framework (Nivel 2 multi-marco) ──
ALTER TABLE public.school_groups
  ADD COLUMN IF NOT EXISTS primary_framework public.curriculum_framework,
  ADD COLUMN IF NOT EXISTS secondary_framework public.curriculum_framework,
  ADD COLUMN IF NOT EXISTS group_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.school_groups.primary_framework IS
  'Marco principal del curso para planificación/evaluación (ej. ib_myp, anep_ebi).';

-- ── Student-level frameworks (Nivel 3 — doble titulación) ──
ALTER TABLE public.school_students
  ADD COLUMN IF NOT EXISTS student_frameworks jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.school_students.student_frameworks IS
  'Array JSON de marcos activos para el alumno, ej. ["anep_ebi","ib_myp"].';

-- ── RLS helpers ──
CREATE OR REPLACE FUNCTION public.profile_role_is_institution_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT pr.role IN ('direccion', 'psicopedagogico', 'admin')
     FROM public.profiles pr
     WHERE pr.user_id = auth.uid()),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.profile_role_is_institution_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT pr.role IN ('direccion', 'admin')
     FROM public.profiles pr
     WHERE pr.user_id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.profile_role_is_institution_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_role_is_institution_admin() TO authenticated;

-- ── RLS: school_curriculum_frameworks ──
ALTER TABLE public.school_curriculum_frameworks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff select school_curriculum_frameworks" ON public.school_curriculum_frameworks;
CREATE POLICY "Staff select school_curriculum_frameworks"
  ON public.school_curriculum_frameworks
  FOR SELECT
  TO authenticated
  USING (
    school_id = public.current_user_school_id()
    AND public.profile_role_is_institution_staff()
  );

DROP POLICY IF EXISTS "Teachers select active frameworks" ON public.school_curriculum_frameworks;
CREATE POLICY "Teachers select active frameworks"
  ON public.school_curriculum_frameworks
  FOR SELECT
  TO authenticated
  USING (
    school_id = public.current_user_school_id()
    AND activo = true
  );

DROP POLICY IF EXISTS "Admin manage school_curriculum_frameworks" ON public.school_curriculum_frameworks;
CREATE POLICY "Admin manage school_curriculum_frameworks"
  ON public.school_curriculum_frameworks
  FOR ALL
  TO authenticated
  USING (
    school_id = public.current_user_school_id()
    AND public.profile_role_is_institution_admin()
  )
  WITH CHECK (
    school_id = public.current_user_school_id()
    AND public.profile_role_is_institution_admin()
  );

-- ── RLS: curriculum_catalogs (global + own school) ──
ALTER TABLE public.curriculum_catalogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated select curriculum_catalogs" ON public.curriculum_catalogs;
CREATE POLICY "Authenticated select curriculum_catalogs"
  ON public.curriculum_catalogs
  FOR SELECT
  TO authenticated
  USING (
    school_id IS NULL
    OR school_id = public.current_user_school_id()
  );

DROP POLICY IF EXISTS "Admin insert curriculum_catalogs" ON public.curriculum_catalogs;
CREATE POLICY "Admin insert curriculum_catalogs"
  ON public.curriculum_catalogs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    school_id = public.current_user_school_id()
    AND public.profile_role_is_institution_admin()
  );

DROP POLICY IF EXISTS "Admin update curriculum_catalogs" ON public.curriculum_catalogs;
CREATE POLICY "Admin update curriculum_catalogs"
  ON public.curriculum_catalogs
  FOR UPDATE
  TO authenticated
  USING (
    school_id = public.current_user_school_id()
    AND public.profile_role_is_institution_admin()
  );

-- ── RLS: curriculum_catalog_items ──
ALTER TABLE public.curriculum_catalog_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated select curriculum_catalog_items" ON public.curriculum_catalog_items;
CREATE POLICY "Authenticated select curriculum_catalog_items"
  ON public.curriculum_catalog_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.curriculum_catalogs c
      WHERE c.id = curriculum_catalog_items.catalog_id
        AND (c.school_id IS NULL OR c.school_id = public.current_user_school_id())
    )
  );

-- ── Staff can update school settings ──
DROP POLICY IF EXISTS "Authenticated users select schools" ON public.schools;
CREATE POLICY "Authenticated users select schools"
  ON public.schools
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin update own school" ON public.schools;
CREATE POLICY "Admin update own school"
  ON public.schools
  FOR UPDATE
  TO authenticated
  USING (
    id = public.current_user_school_id()
    AND public.profile_role_is_institution_admin()
  )
  WITH CHECK (id = public.current_user_school_id());

-- Staff update school_groups framework
DROP POLICY IF EXISTS "Admin update school_groups framework" ON public.school_groups;
CREATE POLICY "Admin update school_groups framework"
  ON public.school_groups
  FOR UPDATE
  TO authenticated
  USING (
    school_id = public.current_user_school_id()
    AND public.profile_role_is_institution_admin()
  )
  WITH CHECK (school_id = public.current_user_school_id());
