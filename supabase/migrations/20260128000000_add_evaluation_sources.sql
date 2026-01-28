-- Migration: Add evaluation sources (sessions + materials + focus)
-- Date: 2026-01-28
-- Purpose: Store multi-session selection, materials, and evaluation focus for evaluations

-- Add columns to evaluaciones table for PHASE 5 features
DO $$ 
BEGIN
  -- source_planificacion_id: planificacion from which sessions are selected
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='evaluaciones' AND column_name='source_planificacion_id') THEN
    ALTER TABLE evaluaciones ADD COLUMN source_planificacion_id uuid REFERENCES planificaciones(id) ON DELETE SET NULL;
  END IF;

  -- source_session_ids: array of sesion IDs to evaluate
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='evaluaciones' AND column_name='source_session_ids') THEN
    ALTER TABLE evaluaciones ADD COLUMN source_session_ids uuid[] DEFAULT '{}';
  END IF;

  -- evaluation_focus: teacher-specified focus text for evaluation
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='evaluaciones' AND column_name='evaluation_focus') THEN
    ALTER TABLE evaluaciones ADD COLUMN evaluation_focus text;
  END IF;

  -- direct_material_ids: materials directly attached to evaluation (not from sessions)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='evaluaciones' AND column_name='direct_material_ids') THEN
    ALTER TABLE evaluaciones ADD COLUMN direct_material_ids uuid[] DEFAULT '{}';
  END IF;

  -- include_session_materials: whether to include materials from selected sessions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='evaluaciones' AND column_name='include_session_materials') THEN
    ALTER TABLE evaluaciones ADD COLUMN include_session_materials boolean DEFAULT false;
  END IF;
END $$;

-- Create index for source_planificacion_id lookups
CREATE INDEX IF NOT EXISTS idx_evaluaciones_source_planificacion
  ON evaluaciones(source_planificacion_id)
  WHERE source_planificacion_id IS NOT NULL AND deleted_at IS NULL;

-- Create GIN index for session IDs array
CREATE INDEX IF NOT EXISTS idx_evaluaciones_source_sessions
  ON evaluaciones USING GIN(source_session_ids)
  WHERE source_session_ids IS NOT NULL AND array_length(source_session_ids, 1) > 0 AND deleted_at IS NULL;

-- Create GIN index for direct material IDs array
CREATE INDEX IF NOT EXISTS idx_evaluaciones_direct_materials
  ON evaluaciones USING GIN(direct_material_ids)
  WHERE direct_material_ids IS NOT NULL AND array_length(direct_material_ids, 1) > 0 AND deleted_at IS NULL;

COMMENT ON COLUMN evaluaciones.source_planificacion_id IS 'Planificacion from which sessions are selected for evaluation (PHASE 5)';
COMMENT ON COLUMN evaluaciones.source_session_ids IS 'Array of sesion_clase IDs to evaluate (PHASE 5)';
COMMENT ON COLUMN evaluaciones.evaluation_focus IS 'Teacher-specified focus text: what to evaluate from selected sessions (PHASE 5)';
COMMENT ON COLUMN evaluaciones.direct_material_ids IS 'Materials directly attached to evaluation (PHASE 5)';
COMMENT ON COLUMN evaluaciones.include_session_materials IS 'Whether to include materials from selected sessions (PHASE 5)';

