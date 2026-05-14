-- Migration: Add Supabase Storage bucket for teacher materials
-- Date: 2026-01-27
-- Purpose: Create storage bucket and RLS policies for teacher_materials library

BEGIN;

-- ============================================================================
-- CREATE STORAGE BUCKET
-- ============================================================================

-- Create storage bucket for teacher materials files
-- Note: public = false (private bucket, requires authentication)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('teacher-materials', 'teacher-materials', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES (RLS for storage.objects)
-- ============================================================================

-- Users can view/list their own material files
-- Path convention: {userId}/{optional-folder}/{timestamp}-{filename}
-- Example: 550e8400-e29b-41d4-a716-446655440000/pdfs/1706345678901-ejemplo.pdf
CREATE POLICY "Users can view their own teacher materials files" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'teacher-materials' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can upload files to their own folder
CREATE POLICY "Users can upload their own teacher materials files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'teacher-materials' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own files (e.g., replace file)
CREATE POLICY "Users can update their own teacher materials files" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'teacher-materials' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own files
CREATE POLICY "Users can delete their own teacher materials files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'teacher-materials' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Note: COMMENT ON POLICY for storage.objects is omitted — local Supabase runs migrations
-- as a role that is not owner of storage.objects (42501). Policy names above are self-explanatory.

COMMIT;


