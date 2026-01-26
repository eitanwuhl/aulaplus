-- Migration: Add explicit save and soft delete for evaluaciones
-- Date: 2025-12-22
-- Purpose: Implement explicit save pattern for evaluations, similar to planificaciones

-- Verify that evaluaciones table exists, or create it
CREATE TABLE IF NOT EXISTS evaluaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Core identification
  nombre text DEFAULT '',  -- Custom name for saved evaluation
  materia text NOT NULL,
  grupo_id text NOT NULL,
  nivel text,
  
  -- Temporal metadata for filtering
  fecha date,  -- Date for range filtering
  
  -- Competencies tracking
  competencias_anep text[] DEFAULT '{}',  -- IDs of competencies used in evaluation
  
  -- Explicit save pattern (matching planificaciones)
  is_saved boolean DEFAULT false,
  saved_at timestamptz,
  deleted_at timestamptz,  -- Soft delete
  
  -- Evaluation payload (preserve existing fields)
  contenidos text[] DEFAULT '{}',  -- Content IDs
  criterios_logro text[] DEFAULT '{}',  -- Criteria IDs
  requerimientos text,  -- Special requirements
  evaluacion_generada jsonb,  -- Generated evaluation content
  rubrica jsonb,  -- Rubric data
  configuracion jsonb,  -- Additional configuration
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add columns to existing evaluaciones table if they don't exist
-- (Safe for both new installations and migrations)
DO $$ 
BEGIN
  -- nombre
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='evaluaciones' AND column_name='nombre') THEN
    ALTER TABLE evaluaciones ADD COLUMN nombre text DEFAULT '';
  END IF;

  -- competencias_anep
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='evaluaciones' AND column_name='competencias_anep') THEN
    ALTER TABLE evaluaciones ADD COLUMN competencias_anep text[] DEFAULT '{}';
  END IF;

  -- is_saved
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='evaluaciones' AND column_name='is_saved') THEN
    ALTER TABLE evaluaciones ADD COLUMN is_saved boolean DEFAULT false;
  END IF;

  -- saved_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='evaluaciones' AND column_name='saved_at') THEN
    ALTER TABLE evaluaciones ADD COLUMN saved_at timestamptz;
  END IF;

  -- deleted_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='evaluaciones' AND column_name='deleted_at') THEN
    ALTER TABLE evaluaciones ADD COLUMN deleted_at timestamptz;
  END IF;

  -- fecha (if doesn't exist)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='evaluaciones' AND column_name='fecha') THEN
    ALTER TABLE evaluaciones ADD COLUMN fecha date;
  END IF;
END $$;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_evaluaciones_user_saved 
  ON evaluaciones(user_id, is_saved, deleted_at)
  WHERE is_saved = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_evaluaciones_filters
  ON evaluaciones(materia, grupo_id, fecha)
  WHERE is_saved = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_evaluaciones_competencias
  ON evaluaciones USING GIN(competencias_anep)
  WHERE is_saved = true AND deleted_at IS NULL;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_evaluaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_evaluaciones_updated_at ON evaluaciones;
CREATE TRIGGER set_evaluaciones_updated_at
  BEFORE UPDATE ON evaluaciones
  FOR EACH ROW
  EXECUTE FUNCTION update_evaluaciones_updated_at();

-- Add comment
COMMENT ON COLUMN evaluaciones.nombre IS 'Custom display name for saved evaluation';
COMMENT ON COLUMN evaluaciones.is_saved IS 'Explicit save flag - only saved evaluations appear in "Mis evaluaciones"';
COMMENT ON COLUMN evaluaciones.saved_at IS 'Timestamp when evaluation was explicitly saved';
COMMENT ON COLUMN evaluaciones.deleted_at IS 'Soft delete timestamp - null means not deleted';
COMMENT ON COLUMN evaluaciones.competencias_anep IS 'Array of competency IDs used in this evaluation';


















