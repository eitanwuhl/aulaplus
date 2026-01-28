-- Migration: Add RLS policies for evaluaciones table
-- Date: 2025-12-22
-- Purpose: Enable RLS and create policies for authenticated users to manage their own evaluaciones

-- Enable RLS on evaluaciones table
ALTER TABLE evaluaciones ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to SELECT their own saved evaluaciones
CREATE POLICY "Users can view their own evaluaciones"
  ON evaluaciones
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND is_saved = true AND deleted_at IS NULL);

-- Policy: Allow users to INSERT their own evaluaciones
CREATE POLICY "Users can insert their own evaluaciones"
  ON evaluaciones
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Allow users to UPDATE their own evaluaciones
CREATE POLICY "Users can update their own evaluaciones"
  ON evaluaciones
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Allow users to soft-delete (UPDATE deleted_at) their own evaluaciones
-- (This is already covered by the UPDATE policy above, but we keep it explicit for clarity)

-- Optional: Add policy for admins to view all evaluaciones (uncomment if needed)
-- CREATE POLICY "Admins can view all evaluaciones"
--   ON evaluaciones
--   FOR SELECT
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM auth.users
--       WHERE id = auth.uid()
--       AND raw_user_meta_data->>'role' = 'admin'
--     )
--   );

COMMENT ON POLICY "Users can view their own evaluaciones" ON evaluaciones IS 'Authenticated users can view their own saved, non-deleted evaluaciones';
COMMENT ON POLICY "Users can insert their own evaluaciones" ON evaluaciones IS 'Authenticated users can create new evaluaciones';
COMMENT ON POLICY "Users can update their own evaluaciones" ON evaluaciones IS 'Authenticated users can update their own evaluaciones (including soft delete)';
























