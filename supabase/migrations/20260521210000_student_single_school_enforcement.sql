-- Regla de negocio: cada fila en school_students pertenece a un único liceo (no se reasigna de tenant).

COMMENT ON TABLE public.school_students IS
  'Catálogo de alumnos. Un alumno = una fila = un solo school_id (un liceo). El id numérico es único en toda la plataforma.';

COMMENT ON COLUMN public.school_students.school_id IS
  'Liceo al que pertenece el alumno. Inmutable tras el alta (no puede migrar a otro liceo en v1).';

CREATE OR REPLACE FUNCTION public.prevent_school_student_school_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.school_id IS DISTINCT FROM NEW.school_id THEN
    RAISE EXCEPTION
      'Un alumno no puede cambiar de liceo (school_id inmutable). Crear un nuevo registro si aplica otro tenant.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_students_prevent_school_change ON public.school_students;
CREATE TRIGGER school_students_prevent_school_change
  BEFORE UPDATE ON public.school_students
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_school_student_school_change();

-- Cuentas de login estudiante (portal) ligadas a un único alumno del catálogo → un solo liceo.
ALTER TABLE public.student_accounts
  ADD COLUMN IF NOT EXISTS catalog_student_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_accounts_catalog_student_id_fkey'
  ) THEN
    ALTER TABLE public.student_accounts
      ADD CONSTRAINT student_accounts_catalog_student_id_fkey
      FOREIGN KEY (catalog_student_id) REFERENCES public.school_students (id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS student_accounts_catalog_student_id_unique
  ON public.student_accounts (catalog_student_id)
  WHERE catalog_student_id IS NOT NULL;

COMMENT ON COLUMN public.student_accounts.catalog_student_id IS
  'Opcional: enlace 1:1 al catálogo school_students (y por tanto a un solo liceo).';
