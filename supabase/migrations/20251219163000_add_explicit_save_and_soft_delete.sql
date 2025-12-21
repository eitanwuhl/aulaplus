-- Migration: Add explicit save and soft delete to planificaciones
-- Purpose: Support explicit saving of planificaciones and soft delete functionality
-- Date: 2025-12-19
-- Author: AI Assistant

BEGIN;

-- ============================================================================
-- ADD COLUMNS TO planificaciones
-- ============================================================================

-- Custom display name for the planification (overrides default materia - grupo_id)
ALTER TABLE planificaciones 
  ADD COLUMN IF NOT EXISTS nombre text;

-- Flag indicating if this planification has been explicitly saved by the teacher
-- Default false means it won't appear in "Planificaciones guardadas" until saved
ALTER TABLE planificaciones 
  ADD COLUMN IF NOT EXISTS is_saved boolean 
    NOT NULL DEFAULT false;

-- Timestamp when the planification was explicitly saved
ALTER TABLE planificaciones 
  ADD COLUMN IF NOT EXISTS saved_at timestamptz;

-- Soft delete: when set, the planification is considered deleted
-- Allows recovery and maintains referential integrity
ALTER TABLE planificaciones 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ============================================================================
-- ADD COMMENTS (Documentation)
-- ============================================================================

COMMENT ON COLUMN planificaciones.nombre IS 
  'Optional custom display name for the planification. If NULL, UI displays materia - grupo_id as fallback.';

COMMENT ON COLUMN planificaciones.is_saved IS 
  'Indicates if teacher has explicitly saved this planification. Only saved planifications appear in "Mis Planificaciones" list. Default false means auto-generated workspace plans are hidden until explicitly saved.';

COMMENT ON COLUMN planificaciones.saved_at IS 
  'Timestamp when teacher explicitly saved this planification. NULL if never saved or if is_saved=false.';

COMMENT ON COLUMN planificaciones.deleted_at IS 
  'Soft delete timestamp. When set (not NULL), planification is considered deleted and hidden from normal views. Allows recovery and maintains FK integrity.';

-- ============================================================================
-- MIGRATE EXISTING DATA (Backward Compatibility)
-- ============================================================================

-- DECISIÓN DE PRODUCTO:
-- NO marcamos automáticamente todas las planificaciones existentes como guardadas.
-- 
-- Razones:
-- 1. El objetivo es que SOLO planificaciones explícitamente guardadas aparezcan en lista.
-- 2. Auto-guardar todo contradice el propósito de la feature.
-- 3. Planificaciones históricas pueden ser borradores, experimentos, etc.
--
-- Consecuencia:
-- - Planificaciones existentes NO aparecerán en "Mis Planificaciones" hasta que el docente
--   entre al workspace y haga click en "Guardar sesión".
-- - Esto es el comportamiento deseado: lista limpia, solo lo explícitamente guardado.
--
-- Alternativa (OPCIONAL, ejecutar manualmente si se requiere):
-- Si el administrador desea marcar ciertas planificaciones como guardadas:
--
-- UPDATE planificaciones
-- SET 
--   is_saved = true,
--   saved_at = created_at
-- WHERE 
--   id IN (
--     -- Listar IDs específicos de planificaciones a preservar
--     'planificacion-id-1',
--     'planificacion-id-2'
--   );
--
-- O marcar todas las que tienen al menos una sesión con plan generado:
--
-- UPDATE planificaciones p
-- SET 
--   is_saved = true,
--   saved_at = created_at
-- WHERE EXISTS (
--   SELECT 1 FROM sesiones_clase s
--   WHERE s.planificacion_id = p.id
--     AND s.plan_desarrollo IS NOT NULL
--     AND s.plan_desarrollo::text != '{}'
-- );

-- NO ejecutamos ningún UPDATE automático aquí.
-- La migración solo agrega columnas y estructura, NO modifica datos existentes.

-- ============================================================================
-- ADD INDEX FOR PERFORMANCE
-- ============================================================================

-- Index for filtering saved and non-deleted planificaciones
-- Supports fast queries: WHERE is_saved = true AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_planificaciones_is_saved_deleted 
  ON planificaciones(is_saved, deleted_at) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- UPDATE RLS POLICIES (if needed)
-- ============================================================================

-- Note: Existing RLS policies (auth.uid() = user_id) are sufficient.
-- Soft-deleted rows are still owned by user, just filtered in application layer.
-- If harder isolation is needed in future, add policy:
-- AND deleted_at IS NULL

COMMIT;

