-- Migration: Complete fix for RLS soft-delete on teacher_materials
-- Date: 2026-01-28
-- Purpose: Remove ALL UPDATE policies and recreate clean ones that allow soft-delete
-- Problem: Multiple UPDATE policies or restrictive WITH CHECK clauses blocking soft-delete

-- ============================================================================
-- ENABLE RLS (idempotent)
-- ============================================================================

ALTER TABLE public.teacher_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_attachments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DROP ALL EXISTING UPDATE POLICIES (dynamic discovery)
-- ============================================================================

-- Drop UPDATE policies for teacher_materials
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  -- Find and drop all UPDATE policies on teacher_materials
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'teacher_materials'
      AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.teacher_materials', policy_record.policyname);
    RAISE NOTICE 'Dropped UPDATE policy: %', policy_record.policyname;
  END LOOP;
END $$;

-- Drop UPDATE policies for material_attachments
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  -- Find and drop all UPDATE policies on material_attachments
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'material_attachments'
      AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.material_attachments', policy_record.policyname);
    RAISE NOTICE 'Dropped UPDATE policy: %', policy_record.policyname;
  END LOOP;
END $$;

-- Also drop known policy names explicitly (belt and suspenders)
DROP POLICY IF EXISTS "Users can update their own teacher_materials" ON public.teacher_materials;
DROP POLICY IF EXISTS "Users can update their own material_attachments" ON public.material_attachments;

-- ============================================================================
-- RECREATE CLEAN UPDATE POLICIES
-- ============================================================================

-- Policy: UPDATE for teacher_materials
-- CRITICAL: WITH CHECK only validates user_id, NOT deleted_at
-- This allows soft-delete (setting deleted_at) while maintaining security
CREATE POLICY "Users can update their own teacher_materials"
  ON public.teacher_materials
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can update their own teacher_materials" ON public.teacher_materials 
  IS 'Allows authenticated users to update their own materials. WITH CHECK only validates user_id ownership, allowing soft-delete via deleted_at.';

-- Policy: UPDATE for material_attachments
CREATE POLICY "Users can update their own material_attachments"
  ON public.material_attachments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Users can update their own material_attachments" ON public.material_attachments 
  IS 'Allows authenticated users to update their own attachments. WITH CHECK only validates user_id ownership, allowing soft-delete via deleted_at.';

-- ============================================================================
-- VERIFICATION: Show all policies for teacher_materials
-- ============================================================================

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  RAISE NOTICE '=== RLS Policies for teacher_materials ===';
  FOR policy_record IN
    SELECT 
      policyname,
      cmd,
      qual,
      with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'teacher_materials'
    ORDER BY cmd, policyname
  LOOP
    RAISE NOTICE 'Policy: % | CMD: % | USING: % | WITH CHECK: %', 
      policy_record.policyname,
      policy_record.cmd,
      COALESCE(policy_record.qual, '(none)'),
      COALESCE(policy_record.with_check, '(none)');
  END LOOP;
  
  RAISE NOTICE '=== Verification: UPDATE policy should have WITH CHECK = (auth.uid() = user_id) ===';
  RAISE NOTICE '=== It should NOT contain deleted_at IS NULL ===';
END $$;

