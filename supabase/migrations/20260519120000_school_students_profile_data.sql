-- Rich student profile fields (avatar, historial, informe técnico, etc.) for Mis Grupos.

ALTER TABLE public.school_students
  ADD COLUMN IF NOT EXISTS profile_data jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.school_students.profile_data IS
  'Campos extendidos del perfil del alumno (contemplaciones, historial, informe técnico, etc.).';
