-- Module 2: Planificador macro (programa anual por grupo + materia)

DO $$ BEGIN
  CREATE TYPE public.programa_estado AS ENUM ('borrador', 'en_revision', 'aprobado', 'en_uso');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.grupo_programas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.schools (id) ON DELETE CASCADE,
  grupo_id text NOT NULL,
  materia text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  anio_lectivo integer NOT NULL DEFAULT (EXTRACT(year FROM CURRENT_DATE)::integer),
  marco_planificacion public.curriculum_framework NOT NULL DEFAULT 'anep_ebi',
  estado public.programa_estado NOT NULL DEFAULT 'borrador',
  nombre text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, grupo_id, materia, anio_lectivo, user_id)
);

ALTER TABLE public.grupo_programas
  DROP CONSTRAINT IF EXISTS grupo_programas_group_fkey;

ALTER TABLE public.grupo_programas
  ADD CONSTRAINT grupo_programas_group_fkey
  FOREIGN KEY (school_id, grupo_id)
  REFERENCES public.school_groups (school_id, id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_grupo_programas_school_user
  ON public.grupo_programas (school_id, user_id);

CREATE INDEX IF NOT EXISTS idx_grupo_programas_lookup
  ON public.grupo_programas (school_id, grupo_id, materia, anio_lectivo);

CREATE TABLE IF NOT EXISTS public.programa_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id uuid NOT NULL REFERENCES public.grupo_programas (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  orden integer NOT NULL DEFAULT 0,
  fecha_inicio date,
  fecha_fin date,
  duracion_semanas integer,
  clases_estimadas integer NOT NULL DEFAULT 1,
  estado text NOT NULL DEFAULT 'planificada'
    CHECK (estado IN ('planificada', 'en_curso', 'completada')),
  catalog_item_ids uuid[] NOT NULL DEFAULT '{}',
  competencias_ids text[] NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_programa_unidades_programa
  ON public.programa_unidades (programa_id, orden);

ALTER TABLE public.planificaciones
  ADD COLUMN IF NOT EXISTS programa_id uuid REFERENCES public.grupo_programas (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_planificaciones_programa
  ON public.planificaciones (programa_id)
  WHERE programa_id IS NOT NULL;

-- ── RLS ──
ALTER TABLE public.grupo_programas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers manage own grupo_programas" ON public.grupo_programas;
CREATE POLICY "Teachers manage own grupo_programas"
  ON public.grupo_programas
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND school_id = public.current_user_school_id()
  )
  WITH CHECK (
    user_id = auth.uid()
    AND school_id = public.current_user_school_id()
  );

DROP POLICY IF EXISTS "Staff read grupo_programas" ON public.grupo_programas;
CREATE POLICY "Staff read grupo_programas"
  ON public.grupo_programas
  FOR SELECT
  TO authenticated
  USING (
    school_id = public.current_user_school_id()
    AND public.profile_role_is_institution_staff()
  );

DROP POLICY IF EXISTS "Admin update grupo_programas estado" ON public.grupo_programas;
CREATE POLICY "Admin update grupo_programas estado"
  ON public.grupo_programas
  FOR UPDATE
  TO authenticated
  USING (
    school_id = public.current_user_school_id()
    AND public.profile_role_is_institution_admin()
  )
  WITH CHECK (school_id = public.current_user_school_id());

ALTER TABLE public.programa_unidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select programa_unidades" ON public.programa_unidades;
CREATE POLICY "Select programa_unidades"
  ON public.programa_unidades
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.grupo_programas gp
      WHERE gp.id = programa_unidades.programa_id
        AND gp.school_id = public.current_user_school_id()
        AND (
          gp.user_id = auth.uid()
          OR public.profile_role_is_institution_staff()
        )
    )
  );

DROP POLICY IF EXISTS "Modify programa_unidades owner" ON public.programa_unidades;
CREATE POLICY "Modify programa_unidades owner"
  ON public.programa_unidades
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.grupo_programas gp
      WHERE gp.id = programa_unidades.programa_id
        AND gp.user_id = auth.uid()
        AND gp.school_id = public.current_user_school_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.grupo_programas gp
      WHERE gp.id = programa_unidades.programa_id
        AND gp.user_id = auth.uid()
        AND gp.school_id = public.current_user_school_id()
    )
  );

COMMENT ON TABLE public.grupo_programas IS 'Module 2: programa anual por grupo, materia y docente.';
COMMENT ON TABLE public.programa_unidades IS 'Module 2: unidades del programa anual con vínculo al catálogo M1.';
