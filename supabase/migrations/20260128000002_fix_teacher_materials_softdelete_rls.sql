-- Migration: Fix soft-delete RLS for teacher_materials
-- Date: 2026-01-28
-- Purpose: Allow UPDATE to set deleted_at without RLS blocking
-- Problem: WITH CHECK was preventing soft-delete operations

-- ============================================================================
-- FIX UPDATE POLICY FOR teacher_materials
-- ============================================================================

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update their own teacher_materials" ON public.teacher_materials;

-- Recreate UPDATE policy WITHOUT deleted_at restriction in WITH CHECK
-- This allows users to soft-delete (set deleted_at) their own materials
CREATE POLICY "Users can update their own teacher_materials"
  ON public.teacher_materials
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Note: SELECT policy still filters deleted_at IS NULL, so archived materials don't appear in queries

COMMENT ON POLICY "Users can update their own teacher_materials" ON public.teacher_materials 
  IS 'Authenticated users can update their own materials (including soft-delete via deleted_at). WITH CHECK only validates user_id to allow setting deleted_at.';

-- ============================================================================
-- FIX UPDATE POLICY FOR material_attachments
-- ============================================================================

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Users can update their own material_attachments" ON public.material_attachments;

-- Recreate UPDATE policy WITHOUT deleted_at restriction in WITH CHECK
CREATE POLICY "Users can update their own material_attachments"
  ON public.material_attachments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can update their own material_attachments" ON public.material_attachments 
  IS 'Authenticated users can update their own attachments (including soft-delete via deleted_at). WITH CHECK only validates user_id to allow setting deleted_at.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Soft-delete RLS policies updated successfully. Archive operations should now work.';
END $$;

