-- ============================================================================
-- Create evaluaciones table and dependencies
-- ============================================================================
-- Purpose: Create the evaluaciones table with all required columns, indexes, 
--          triggers, and RLS policies for the evaluation save flow.
-- 
-- This script combines:
--   - supabase/migrations/20251222000000_add_evaluaciones_explicit_save.sql
--   - supabase/migrations/20251222000001_add_evaluaciones_rls_policies.sql
--
-- Execute this in Supabase SQL Editor if the table does not exist.
-- ============================================================================

BEGIN;

-- ============================================================================
-- CREATE TABLE: evaluaciones
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.evaluaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
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

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

-- Index for filtering saved and non-deleted evaluaciones
CREATE INDEX IF NOT EXISTS idx_evaluaciones_user_saved 
  ON public.evaluaciones(user_id, is_saved, deleted_at)
  WHERE is_saved = true AND deleted_at IS NULL;

-- Index for filtering by materia, grupo_id, fecha
CREATE INDEX IF NOT EXISTS idx_evaluaciones_filters
  ON public.evaluaciones(materia, grupo_id, fecha)
  WHERE is_saved = true AND deleted_at IS NULL;

-- GIN index for array queries on competencias_anep
CREATE INDEX IF NOT EXISTS idx_evaluaciones_competencias
  ON public.evaluaciones USING GIN(competencias_anep)
  WHERE is_saved = true AND deleted_at IS NULL;

-- ============================================================================
-- CREATE TRIGGER FUNCTION: update_evaluaciones_updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_evaluaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE TRIGGER: set_evaluaciones_updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS set_evaluaciones_updated_at ON public.evaluaciones;
CREATE TRIGGER set_evaluaciones_updated_at
  BEFORE UPDATE ON public.evaluaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_evaluaciones_updated_at();

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.evaluaciones ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES
-- ============================================================================

-- Policy: Allow users to SELECT their own saved evaluaciones
DROP POLICY IF EXISTS "Users can view their own evaluaciones" ON public.evaluaciones;
CREATE POLICY "Users can view their own evaluaciones"
  ON public.evaluaciones
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND is_saved = true AND deleted_at IS NULL);

-- Policy: Allow users to INSERT their own evaluaciones
DROP POLICY IF EXISTS "Users can insert their own evaluaciones" ON public.evaluaciones;
CREATE POLICY "Users can insert their own evaluaciones"
  ON public.evaluaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Allow users to UPDATE their own evaluaciones
DROP POLICY IF EXISTS "Users can update their own evaluaciones" ON public.evaluaciones;
CREATE POLICY "Users can update their own evaluaciones"
  ON public.evaluaciones
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- ADD COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE public.evaluaciones IS 'Evaluaciones generadas y guardadas por docentes';
COMMENT ON COLUMN public.evaluaciones.nombre IS 'Custom display name for saved evaluation';
COMMENT ON COLUMN public.evaluaciones.is_saved IS 'Explicit save flag - only saved evaluations appear in "Mis evaluaciones"';
COMMENT ON COLUMN public.evaluaciones.saved_at IS 'Timestamp when evaluation was explicitly saved';
COMMENT ON COLUMN public.evaluaciones.deleted_at IS 'Soft delete timestamp - null means not deleted';
COMMENT ON COLUMN public.evaluaciones.competencias_anep IS 'Array of competency IDs used in this evaluation';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERY (Run after execution to confirm table exists)
-- ============================================================================
-- SELECT 
--   table_name, 
--   column_name, 
--   data_type 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'evaluaciones'
-- ORDER BY ordinal_position;
-- ============================================================================


















