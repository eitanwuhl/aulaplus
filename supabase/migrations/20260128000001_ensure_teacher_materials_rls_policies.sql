-- Migration: Ensure RLS policies exist for teacher_materials
-- Date: 2026-01-28
-- Purpose: Fix archive RLS error by ensuring UPDATE policy exists
-- Idempotent: Safe to run multiple times

-- ============================================================================
-- ENSURE RLS IS ENABLED
-- ============================================================================

-- Enable RLS on teacher_materials (idempotent)
ALTER TABLE public.teacher_materials ENABLE ROW LEVEL SECURITY;

-- Enable RLS on material_attachments (idempotent)
ALTER TABLE public.material_attachments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DROP EXISTING POLICIES (for clean re-creation)
-- ============================================================================

-- Drop teacher_materials policies if they exist
DROP POLICY IF EXISTS "Users can view their own teacher_materials" ON public.teacher_materials;
DROP POLICY IF EXISTS "Users can create their own teacher_materials" ON public.teacher_materials;
DROP POLICY IF EXISTS "Users can update their own teacher_materials" ON public.teacher_materials;
DROP POLICY IF EXISTS "Users can delete their own teacher_materials" ON public.teacher_materials;

-- Drop material_attachments policies if they exist
DROP POLICY IF EXISTS "Users can view their own material_attachments" ON public.material_attachments;
DROP POLICY IF EXISTS "Users can create their own material_attachments" ON public.material_attachments;
DROP POLICY IF EXISTS "Users can update their own material_attachments" ON public.material_attachments;
DROP POLICY IF EXISTS "Users can delete their own material_attachments" ON public.material_attachments;

-- ============================================================================
-- RECREATE POLICIES FOR teacher_materials
-- ============================================================================

-- Policy: SELECT - Users can view their own materials (non-deleted)
CREATE POLICY "Users can view their own teacher_materials"
  ON public.teacher_materials
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Policy: INSERT - Users can create their own materials
CREATE POLICY "Users can create their own teacher_materials"
  ON public.teacher_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: UPDATE - Users can update their own materials
-- CRITICAL: This allows soft-delete via setting deleted_at
CREATE POLICY "Users can update their own teacher_materials"
  ON public.teacher_materials
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: DELETE - Users can hard-delete their own materials (optional, for future use)
CREATE POLICY "Users can delete their own teacher_materials"
  ON public.teacher_materials
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- RECREATE POLICIES FOR material_attachments
-- ============================================================================

-- Policy: SELECT - Users can view their own attachments (non-deleted)
CREATE POLICY "Users can view their own material_attachments"
  ON public.material_attachments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Policy: INSERT - Users can create their own attachments
CREATE POLICY "Users can create their own material_attachments"
  ON public.material_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: UPDATE - Users can update their own attachments
CREATE POLICY "Users can update their own material_attachments"
  ON public.material_attachments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: DELETE - Users can hard-delete their own attachments (optional, for future use)
CREATE POLICY "Users can delete their own material_attachments"
  ON public.material_attachments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Users can view their own teacher_materials" ON public.teacher_materials 
  IS 'Authenticated users can view their own non-deleted materials';

COMMENT ON POLICY "Users can create their own teacher_materials" ON public.teacher_materials 
  IS 'Authenticated users can create new materials';

COMMENT ON POLICY "Users can update their own teacher_materials" ON public.teacher_materials 
  IS 'Authenticated users can update their own materials (including soft delete via deleted_at)';

COMMENT ON POLICY "Users can delete their own teacher_materials" ON public.teacher_materials 
  IS 'Authenticated users can hard-delete their own materials';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify RLS is enabled
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'teacher_materials' AND relnamespace = 'public'::regnamespace) THEN
    RAISE EXCEPTION 'RLS is not enabled on teacher_materials';
  END IF;
  
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'material_attachments' AND relnamespace = 'public'::regnamespace) THEN
    RAISE EXCEPTION 'RLS is not enabled on material_attachments';
  END IF;
  
  RAISE NOTICE 'RLS policies successfully created/updated for teacher_materials and material_attachments';
END $$;

