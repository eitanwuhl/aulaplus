-- Add ai_design_report JSONB column to sesiones_clase table
-- This stores AI design evidence/rationale for individual session plan generation

ALTER TABLE public.sesiones_clase
ADD COLUMN IF NOT EXISTS ai_design_report jsonb;

COMMENT ON COLUMN public.sesiones_clase.ai_design_report IS 
  'AI design evidence/rationale for this session: { inputsUsed, decisions, assumptions, changesFromPrevious }.
   Safe design report (inputs used, decisions, assumptions), NOT raw chain-of-thought.';

DO $$
BEGIN
  RAISE NOTICE 'Column ai_design_report added to sesiones_clase';
END $$;
