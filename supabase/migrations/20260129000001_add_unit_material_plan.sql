-- PHASE A: Add unit_material_plan JSONB column to planificaciones table
-- This stores per-unit material plans with class count and per-class guidance

ALTER TABLE public.planificaciones
ADD COLUMN IF NOT EXISTS unit_material_plan jsonb NOT NULL DEFAULT '[]';

-- Add comment for clarity
COMMENT ON COLUMN public.planificaciones.unit_material_plan IS 
  'Array of unit material plans: [{ materialId, materialTitle, classCount, perClassGuidance[] }]. 
   Stored per-unit in the wizard data and persisted with the planification.';

-- Optional: Add GIN index for efficient JSONB queries if needed in the future
-- CREATE INDEX IF NOT EXISTS idx_planificaciones_unit_material_plan_gin 
--   ON public.planificaciones USING GIN (unit_material_plan);

RAISE NOTICE 'Column unit_material_plan added to planificaciones';

