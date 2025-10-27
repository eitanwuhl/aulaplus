-- Paso 1: Hacer fecha opcional y crear enum
ALTER TABLE sesiones_clase ALTER COLUMN fecha DROP NOT NULL;

-- Crear enum para estado de sesión si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='sesion_estado') THEN
    CREATE TYPE sesion_estado AS ENUM ('backlog','planificada','dictada','omitida','pausada');
  END IF;
END$$;