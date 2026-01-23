-- Verification script for session_brief column
-- Run this in Supabase SQL Editor to verify the column exists

-- Check if column exists
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'sesiones_clase' 
  AND column_name = 'session_brief';

-- If column does NOT exist, run:
-- ALTER TABLE public.sesiones_clase ADD COLUMN IF NOT EXISTS session_brief text;

-- Verify index exists
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE schemaname = 'public'
  AND tablename = 'sesiones_clase' 
  AND indexname = 'idx_sesiones_clase_planificacion_orden';

-- Test query (should work if column exists)
-- SELECT orden, session_brief, titulo, contenidos_anep
-- FROM sesiones_clase
-- WHERE planificacion_id = '<PLAN_ID>'
-- ORDER BY orden
-- LIMIT 5;










