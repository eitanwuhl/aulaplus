-- Paso 2: Modificar columna estado existente
-- Primero verificar si la columna estado existe y es de tipo text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='sesiones_clase' AND column_name='estado' AND data_type='text'
  ) THEN
    ALTER TABLE sesiones_clase DROP COLUMN estado;
  END IF;
END$$;

-- Agregar columna estado con el nuevo tipo enum
ALTER TABLE sesiones_clase
  ADD COLUMN IF NOT EXISTS estado sesion_estado NOT NULL DEFAULT 'backlog';