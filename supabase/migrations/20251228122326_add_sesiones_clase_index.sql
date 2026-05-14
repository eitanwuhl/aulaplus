-- PHASE 3.2.1: Column orden + index for sesiones_clase (planificacion_id, orden)
-- Original schema never added orden; later migrations commented out orden indexes.
-- App code (session briefs, wizard) expects orden (1-based within each planificación).

ALTER TABLE public.sesiones_clase
  ADD COLUMN IF NOT EXISTS orden INTEGER;

-- Backfill missing orden per planificación (stable: fecha, then created_at).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY planificacion_id
      ORDER BY fecha NULLS LAST, created_at
    ) AS rn
  FROM public.sesiones_clase
  WHERE orden IS NULL
)
UPDATE public.sesiones_clase s
SET orden = r.rn
FROM ranked r
WHERE s.id = r.id;

CREATE INDEX IF NOT EXISTS idx_sesiones_clase_planificacion_orden
ON public.sesiones_clase(planificacion_id, orden);

COMMENT ON COLUMN public.sesiones_clase.orden IS
  '1-based order of the session within the planificación. Used by session brief load/persist and UI.';

COMMENT ON INDEX idx_sesiones_clase_planificacion_orden IS
  'Index for queries by planificacion_id ordered by orden (session briefs, persistence).';
