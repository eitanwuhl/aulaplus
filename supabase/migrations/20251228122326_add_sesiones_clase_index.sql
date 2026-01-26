-- PHASE 3.2.1: Add index for sesiones_clase queries by planificacion_id and orden
-- This index optimizes:
-- 1. loadSessionBriefs() - fetches sessions ordered by orden for a planificacion_id
-- 2. persistSessionBriefs() - updates sessions by planificacion_id and orden
-- 3. General queries filtering by planificacion_id and ordering by orden

CREATE INDEX IF NOT EXISTS idx_sesiones_clase_planificacion_orden
ON public.sesiones_clase(planificacion_id, orden);

-- Add comment for documentation
COMMENT ON INDEX idx_sesiones_clase_planificacion_orden IS 'Index for efficient queries filtering by planificacion_id and ordering by orden. Used by session brief loading and persistence functions.';











