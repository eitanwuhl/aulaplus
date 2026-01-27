-- Migration: Add teacher materials library and attachments schema
-- Date: 2026-01-27
-- Purpose: Support reusable teacher materials library with attachments to planificaciones, sesiones_clase, and evaluaciones

BEGIN;

-- ============================================================================
-- CREATE teacher_materials TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teacher_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Core metadata
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,  -- Path/URL to stored file
  mime_type TEXT,  -- MIME type of the file (e.g., 'application/pdf', 'image/png')
  
  -- Optional metadata (minimal, stored as JSONB for flexibility)
  metadata JSONB DEFAULT '{}',  -- Can store: tags, notes, subject, level, etc.
  
  -- Soft delete support
  deleted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- CREATE material_attachments TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.material_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.teacher_materials(id) ON DELETE CASCADE,
  
  -- Polymorphic target (planificacion, sesion, evaluacion)
  target_type TEXT NOT NULL CHECK (target_type IN ('planificacion', 'sesion', 'evaluacion')),
  target_id UUID NOT NULL,  -- References planificaciones.id, sesiones_clase.id, or evaluaciones.id
  
  -- Optional attachment metadata
  focus_text TEXT,  -- Optional context/notes about how material is used
  priority INTEGER DEFAULT 0,  -- Optional priority for ordering (higher = more important)
  
  -- Soft delete support
  deleted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

-- Indexes for teacher_materials
CREATE INDEX IF NOT EXISTS idx_teacher_materials_user_id 
  ON public.teacher_materials(user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_materials_created_at 
  ON public.teacher_materials(created_at DESC)
  WHERE deleted_at IS NULL;

-- Indexes for material_attachments
CREATE INDEX IF NOT EXISTS idx_material_attachments_user_id 
  ON public.material_attachments(user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_material_attachments_target 
  ON public.material_attachments(target_type, target_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_material_attachments_material_id 
  ON public.material_attachments(material_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_material_attachments_priority 
  ON public.material_attachments(priority DESC, created_at DESC)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.teacher_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_attachments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR teacher_materials
-- ============================================================================

-- Users can view their own materials (non-deleted)
CREATE POLICY "Users can view their own teacher_materials"
  ON public.teacher_materials
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can create their own materials
CREATE POLICY "Users can create their own teacher_materials"
  ON public.teacher_materials
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own materials
CREATE POLICY "Users can update their own teacher_materials"
  ON public.teacher_materials
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can soft-delete their own materials (via UPDATE deleted_at)
-- Covered by UPDATE policy above

-- ============================================================================
-- RLS POLICIES FOR material_attachments
-- ============================================================================

-- Users can view their own attachments (non-deleted)
CREATE POLICY "Users can view their own material_attachments"
  ON public.material_attachments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can create their own attachments
CREATE POLICY "Users can create their own material_attachments"
  ON public.material_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own attachments
CREATE POLICY "Users can update their own material_attachments"
  ON public.material_attachments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can soft-delete their own attachments (via UPDATE deleted_at)
-- Covered by UPDATE policy above

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Use existing update_updated_at_column function (from initial schema)
CREATE TRIGGER update_teacher_materials_updated_at
  BEFORE UPDATE ON public.teacher_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_material_attachments_updated_at
  BEFORE UPDATE ON public.material_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE public.teacher_materials IS 
  'Reusable library of teacher materials (files, resources) that can be attached to planificaciones, sesiones_clase, or evaluaciones.';

COMMENT ON COLUMN public.teacher_materials.storage_path IS 
  'Path or URL to the stored file. Can be Supabase Storage path, external URL, or local path reference.';

COMMENT ON COLUMN public.teacher_materials.metadata IS 
  'Optional JSONB metadata: tags (array), notes (text), subject (text), level (text), etc.';

COMMENT ON TABLE public.material_attachments IS 
  'Links teacher materials to planificaciones, sesiones_clase, or evaluaciones. Supports polymorphic relationships.';

COMMENT ON COLUMN public.material_attachments.target_type IS 
  'Type of target: ''planificacion'', ''sesion'', or ''evaluacion''.';

COMMENT ON COLUMN public.material_attachments.target_id IS 
  'UUID of the target (planificaciones.id, sesiones_clase.id, or evaluaciones.id).';

COMMENT ON COLUMN public.material_attachments.focus_text IS 
  'Optional context about how this material is used in this specific attachment.';

COMMENT ON COLUMN public.material_attachments.priority IS 
  'Optional priority for ordering attachments (higher = more important). Default 0.';

COMMIT;





