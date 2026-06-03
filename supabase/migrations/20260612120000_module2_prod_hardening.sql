-- Module 2 production hardening: estado transitions + admin column guard

CREATE OR REPLACE FUNCTION public.grupo_programas_before_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner boolean := (OLD.user_id = auth.uid());
  is_admin boolean := public.profile_role_is_institution_admin();
BEGIN
  -- Dirección sobre programa ajeno: solo estado y updated_at
  IF is_admin AND NOT is_owner THEN
    IF NEW.school_id IS DISTINCT FROM OLD.school_id
      OR NEW.grupo_id IS DISTINCT FROM OLD.grupo_id
      OR NEW.materia IS DISTINCT FROM OLD.materia
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.anio_lectivo IS DISTINCT FROM OLD.anio_lectivo
      OR NEW.marco_planificacion IS DISTINCT FROM OLD.marco_planificacion
      OR NEW.nombre IS DISTINCT FROM OLD.nombre
      OR NEW.metadata IS DISTINCT FROM OLD.metadata
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Dirección solo puede modificar el estado del programa';
    END IF;
  END IF;

  -- Transiciones de estado
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF is_owner AND NOT is_admin THEN
      IF NOT (
        (OLD.estado = 'borrador' AND NEW.estado = 'en_revision')
        OR (OLD.estado = 'aprobado' AND NEW.estado = 'en_uso')
      ) THEN
        RAISE EXCEPTION 'Transición de estado no permitida para el docente';
      END IF;
    ELSIF is_admin THEN
      IF NOT (
        (OLD.estado = 'en_revision' AND NEW.estado = 'aprobado')
        OR (OLD.estado = 'aprobado' AND NEW.estado = 'en_uso')
      ) THEN
        RAISE EXCEPTION 'Transición de estado no permitida para dirección';
      END IF;
    ELSE
      RAISE EXCEPTION 'No autorizado para cambiar el estado del programa';
    END IF;
  END IF;

  -- Docente no puede editar campos si el programa ya no está en borrador
  IF is_owner AND NOT is_admin AND OLD.estado <> 'borrador' THEN
    IF NEW.school_id IS DISTINCT FROM OLD.school_id
      OR NEW.grupo_id IS DISTINCT FROM OLD.grupo_id
      OR NEW.materia IS DISTINCT FROM OLD.materia
      OR NEW.anio_lectivo IS DISTINCT FROM OLD.anio_lectivo
      OR NEW.marco_planificacion IS DISTINCT FROM OLD.marco_planificacion
      OR NEW.nombre IS DISTINCT FROM OLD.nombre
      OR NEW.metadata IS DISTINCT FROM OLD.metadata
    THEN
      RAISE EXCEPTION 'El programa no está en edición';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grupo_programas_before_update_guard ON public.grupo_programas;
CREATE TRIGGER grupo_programas_before_update_guard
  BEFORE UPDATE ON public.grupo_programas
  FOR EACH ROW
  EXECUTE FUNCTION public.grupo_programas_before_update_guard();

COMMENT ON FUNCTION public.grupo_programas_before_update_guard() IS
  'Enforces programa estado workflow and prevents admin from overwriting teacher program content.';
