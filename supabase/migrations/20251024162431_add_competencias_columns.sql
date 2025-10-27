-- Migration: Add competency and content tracking columns to planificaciones
-- Purpose: Store flattened, deduplicated competencies extracted from unidades_didacticas
-- Date: 2025-10-24

BEGIN;

-- ============================================================================
-- ADD COLUMNS
-- ============================================================================

-- Flattened array of all competency IDs selected across all units
ALTER TABLE planificaciones 
  ADD COLUMN IF NOT EXISTS competencias_seleccionadas text[] 
    NOT NULL DEFAULT '{}'::text[];

-- Extracted content texts from all units (for quick reference)
ALTER TABLE planificaciones 
  ADD COLUMN IF NOT EXISTS contenidos_programa text[] 
    NOT NULL DEFAULT '{}'::text[];

-- JSON mapping of contenido_id → competencias_ids (for traceability)
ALTER TABLE planificaciones 
  ADD COLUMN IF NOT EXISTS mapeo_competencias_contenidos jsonb 
    NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================================
-- ADD COMMENTS (Documentation)
-- ============================================================================

COMMENT ON COLUMN planificaciones.competencias_seleccionadas IS 
  'Flattened, deduplicated list of all competency IDs selected across unidades_didacticas. Extracted at creation time for efficient querying and distribution to sessions.';

COMMENT ON COLUMN planificaciones.contenidos_programa IS 
  'Extracted content texts from unidades_didacticas for quick reference. Parallel array to competencias_seleccionadas.';

COMMENT ON COLUMN planificaciones.mapeo_competencias_contenidos IS 
  'JSON mapping of contenido_id to competencias_ids for traceability. Example: {"contenido-123": ["comp-1", "comp-2"]}.';

COMMIT;

