-- PHASE C: Add ai_design_report JSONB columns to evaluations and planificaciones
-- This stores AI design evidence/rationale for both planning and evaluation generation

-- Add to evaluations table
ALTER TABLE public.evaluaciones
ADD COLUMN IF NOT EXISTS ai_design_report jsonb;

-- Add to planificaciones table
ALTER TABLE public.planificaciones
ADD COLUMN IF NOT EXISTS ai_design_report jsonb;

-- Add comments for clarity
COMMENT ON COLUMN public.evaluaciones.ai_design_report IS 
  'AI design evidence/rationale: { inputsUsed, decisions, assumptions, changesFromPrevious }.
   Safe design report (inputs used, decisions, assumptions), NOT raw chain-of-thought.';

COMMENT ON COLUMN public.planificaciones.ai_design_report IS 
  'AI design evidence/rationale: { inputsUsed, decisions, assumptions, changesFromPrevious }.
   Safe design report (inputs used, decisions, assumptions), NOT raw chain-of-thought.';

-- Optional: Add GIN indexes for efficient JSONB queries if needed in the future
-- CREATE INDEX IF NOT EXISTS idx_evaluaciones_ai_design_report_gin 
--   ON public.evaluaciones USING GIN (ai_design_report);
-- CREATE INDEX IF NOT EXISTS idx_planificaciones_ai_design_report_gin 
--   ON public.planificaciones USING GIN (ai_design_report);

DO $$
BEGIN
  RAISE NOTICE 'Columns ai_design_report added to evaluaciones and planificaciones';
END $$;

