-- Migration: Add extracted_text column to teacher_materials
-- Date: 2026-01-28
-- Purpose: Store extracted PDF text for AI evaluation generation context

-- ============================================================================
-- ADD extracted_text COLUMN
-- ============================================================================

ALTER TABLE public.teacher_materials
ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- Add index for full-text search (optional, for future use)
CREATE INDEX IF NOT EXISTS idx_teacher_materials_extracted_text 
  ON public.teacher_materials 
  USING gin(to_tsvector('spanish', coalesce(extracted_text, '')))
  WHERE extracted_text IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN public.teacher_materials.extracted_text IS 
  'Extracted text content from PDF files. Used for AI evaluation generation context. Bounded to first 3-5 pages or ~10k characters.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Column extracted_text added to teacher_materials';
  RAISE NOTICE 'Index created for full-text search (optional)';
END $$;

