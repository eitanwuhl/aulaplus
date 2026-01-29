-- Migration: Add RPC function for archiving teacher materials
-- Date: 2026-01-28
-- Purpose: Bypass RLS edge-case by using SECURITY DEFINER RPC that enforces ownership
-- Problem: Direct UPDATE fails with RLS 42501 despite correct policies and ownership

-- ============================================================================
-- CREATE RPC FUNCTION FOR ARCHIVING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.archive_teacher_material(material_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id uuid;
  v_material_user_id uuid;
  v_rows_updated integer;
BEGIN
  -- Get current authenticated user
  v_current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Check if material exists and get its user_id
  SELECT tm.user_id
  INTO v_material_user_id
  FROM public.teacher_materials tm
  WHERE tm.id = material_id;

  -- If material not found
  IF v_material_user_id IS NULL THEN
    RAISE EXCEPTION 'Material not found' USING ERRCODE = 'P0001';
  END IF;

  -- Check ownership
  IF v_material_user_id != v_current_user_id THEN
    RAISE EXCEPTION 'Not authorized to archive this material' USING ERRCODE = '42501';
  END IF;

  -- Perform the archive (soft-delete)
  -- SECURITY DEFINER bypasses RLS, but we've already verified ownership above
  UPDATE public.teacher_materials
  SET deleted_at = now()
  WHERE id = material_id
    AND user_id = v_current_user_id
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  -- If no rows updated, material was already archived
  IF v_rows_updated = 0 THEN
    -- Double-check: maybe it was already deleted
    IF EXISTS (
      SELECT 1 FROM public.teacher_materials 
      WHERE id = material_id AND deleted_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Material already archived' USING ERRCODE = 'P0002';
    ELSE
      -- This shouldn't happen given our checks, but handle gracefully
      RAISE EXCEPTION 'Failed to archive material' USING ERRCODE = 'P0003';
    END IF;
  END IF;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'material_id', material_id,
    'archived_at', now()
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise with context
    RAISE;
END;
$$;

-- ============================================================================
-- SET PERMISSIONS
-- ============================================================================

-- Revoke all permissions from public
REVOKE ALL ON FUNCTION public.archive_teacher_material(uuid) FROM public;

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION public.archive_teacher_material(uuid) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.archive_teacher_material(uuid) IS 
  'Archives (soft-deletes) a teacher material. SECURITY DEFINER bypasses RLS but enforces ownership internally. Only the material owner can archive their own materials.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'RPC function archive_teacher_material(uuid) created successfully';
  RAISE NOTICE 'Permissions: EXECUTE granted to authenticated users only';
END $$;

