-- Verification Script: Check RLS Policies for teacher_materials
-- Run this in Supabase SQL Editor to verify policies are correct

-- ============================================================================
-- Show all policies for teacher_materials
-- ============================================================================

SELECT 
  policyname AS "Policy Name",
  cmd AS "Command",
  qual AS "USING (qual)",
  with_check AS "WITH CHECK",
  CASE 
    WHEN cmd = 'UPDATE' AND with_check LIKE '%deleted_at%' THEN '❌ BLOCKS SOFT-DELETE'
    WHEN cmd = 'UPDATE' AND with_check = '(auth.uid() = user_id)' THEN '✅ ALLOWS SOFT-DELETE'
    WHEN cmd = 'SELECT' AND qual LIKE '%deleted_at IS NULL%' THEN '✅ FILTERS DELETED'
    ELSE 'OK'
  END AS "Status"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'teacher_materials'
ORDER BY 
  CASE cmd
    WHEN 'SELECT' THEN 1
    WHEN 'INSERT' THEN 2
    WHEN 'UPDATE' THEN 3
    WHEN 'DELETE' THEN 4
    ELSE 5
  END,
  policyname;

-- ============================================================================
-- Verify UPDATE policy specifically
-- ============================================================================

SELECT 
  'UPDATE Policy Check' AS check_type,
  policyname,
  with_check,
  CASE 
    WHEN with_check LIKE '%deleted_at%' THEN 'FAIL: Contains deleted_at restriction'
    WHEN with_check = '(auth.uid() = user_id)' THEN 'PASS: Only checks user_id'
    ELSE 'WARN: Unexpected WITH CHECK clause'
  END AS result
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'teacher_materials'
  AND cmd = 'UPDATE';

-- ============================================================================
-- Test soft-delete operation (run as authenticated user)
-- ============================================================================

-- This should work if RLS is correct:
-- UPDATE public.teacher_materials 
-- SET deleted_at = NOW() 
-- WHERE id = '<your-material-id>' 
--   AND user_id = auth.uid();

