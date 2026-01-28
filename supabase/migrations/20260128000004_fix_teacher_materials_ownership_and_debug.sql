-- Migration: Fix teacher_materials ownership and add debug function
-- Date: 2026-01-28
-- Purpose: 
--   1. Ensure user_id cannot be changed on UPDATE (security)
--   2. Add debug function to verify ownership
--   3. Add trigger to protect user_id from accidental changes

-- ============================================================================
-- CREATE DEBUG FUNCTION (SECURITY DEFINER for debugging, but with checks)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.debug_teacher_material_ownership(material_id uuid)
RETURNS TABLE (
  material_id_out uuid,
  material_user_id uuid,
  current_user_id uuid,
  ownership_matches boolean,
  deleted_at timestamptz,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material_user_id uuid;
  v_deleted_at timestamptz;
  v_current_user_id uuid;
BEGIN
  -- Get current authenticated user
  v_current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF v_current_user_id IS NULL THEN
    RETURN QUERY SELECT 
      material_id::uuid,
      NULL::uuid,
      NULL::uuid,
      false::boolean,
      NULL::timestamptz,
      'User not authenticated'::text;
    RETURN;
  END IF;

  -- Fetch material (bypassing RLS due to SECURITY DEFINER)
  SELECT tm.user_id, tm.deleted_at
  INTO v_material_user_id, v_deleted_at
  FROM public.teacher_materials tm
  WHERE tm.id = material_id;

  -- If material not found
  IF v_material_user_id IS NULL THEN
    RETURN QUERY SELECT 
      material_id::uuid,
      NULL::uuid,
      v_current_user_id::uuid,
      false::boolean,
      NULL::timestamptz,
      'Material not found'::text;
    RETURN;
  END IF;

  -- Return ownership info
  RETURN QUERY SELECT 
    material_id::uuid,
    v_material_user_id::uuid,
    v_current_user_id::uuid,
    (v_material_user_id = v_current_user_id)::boolean,
    v_deleted_at::timestamptz,
    CASE 
      WHEN v_material_user_id != v_current_user_id THEN 'Ownership mismatch: material belongs to different user'
      ELSE NULL
    END::text;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.debug_teacher_material_ownership(uuid) TO authenticated;

COMMENT ON FUNCTION public.debug_teacher_material_ownership(uuid) IS 
  'Debug function to check material ownership. Returns material user_id, current user_id, and whether they match. SECURITY DEFINER bypasses RLS but includes ownership checks.';

-- ============================================================================
-- CREATE TRIGGER TO PREVENT user_id CHANGES ON UPDATE
-- ============================================================================

-- Function to prevent user_id changes
CREATE OR REPLACE FUNCTION public.prevent_user_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If user_id is being changed, raise error
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Cannot change user_id on teacher_materials. user_id is immutable after creation.';
  END IF;
  
  -- Allow the update to proceed (only updated_at will change via other trigger)
  RETURN NEW;
END;
$$;

-- Create trigger (if not exists)
DROP TRIGGER IF EXISTS prevent_teacher_materials_user_id_change ON public.teacher_materials;
CREATE TRIGGER prevent_teacher_materials_user_id_change
  BEFORE UPDATE ON public.teacher_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_id_change();

COMMENT ON TRIGGER prevent_teacher_materials_user_id_change ON public.teacher_materials IS 
  'Prevents accidental or malicious changes to user_id. user_id is set on INSERT and cannot be modified.';

-- Same for material_attachments
CREATE OR REPLACE FUNCTION public.prevent_attachment_user_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Cannot change user_id on material_attachments. user_id is immutable after creation.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_material_attachments_user_id_change ON public.material_attachments;
CREATE TRIGGER prevent_material_attachments_user_id_change
  BEFORE UPDATE ON public.material_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_attachment_user_id_change();

-- ============================================================================
-- VERIFICATION: Show trigger info
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Triggers created successfully:';
  RAISE NOTICE '  - prevent_teacher_materials_user_id_change: Prevents user_id changes on UPDATE';
  RAISE NOTICE '  - prevent_material_attachments_user_id_change: Prevents user_id changes on UPDATE';
  RAISE NOTICE 'Debug function created: debug_teacher_material_ownership(uuid)';
END $$;

