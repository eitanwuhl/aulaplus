-- PHASE 3.2: Add session_brief column to sesiones_clase table
-- This column stores the optional teacher-provided topic/focus for each class session

ALTER TABLE public.sesiones_clase
ADD COLUMN IF NOT EXISTS session_brief text;

-- Add comment for documentation
COMMENT ON COLUMN public.sesiones_clase.session_brief IS 'Optional teacher-provided topic/focus for this session. Used to override AI-generated topics.';




















