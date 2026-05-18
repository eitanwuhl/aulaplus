-- Group/student notifications: visible only to teachers assigned to that group (public.grupos).
-- Broadcast (no group_id, no student_id): all teachers. Personal: recipient_user_id = auth.uid().

DROP POLICY IF EXISTS "Teachers select visible dashboard_notifications" ON public.dashboard_notifications;

CREATE POLICY "Teachers select visible dashboard_notifications"
  ON public.dashboard_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.user_id = auth.uid()
        AND COALESCE(pr.role, '') = 'teacher'
    )
    AND (
      recipient_user_id = auth.uid()
      OR (
        recipient_user_id IS NULL
        AND (
          (student_id IS NULL AND group_id IS NULL)
          OR (
            group_id IS NOT NULL
            AND student_id IS NULL
            AND EXISTS (
              SELECT 1
              FROM public.grupos g
              WHERE g.id = dashboard_notifications.group_id
                AND g.user_id = auth.uid()
            )
          )
          OR (
            student_id IS NOT NULL
            AND group_id IS NULL
            AND EXISTS (
              SELECT 1
              FROM public.school_students ss
              INNER JOIN public.grupos g ON g.id = ss.school_group_id
              WHERE ss.id = dashboard_notifications.student_id
                AND g.user_id = auth.uid()
            )
          )
        )
      )
    )
  );

-- Creating a group/student-linked aviso: only if the teacher is assigned to that group in public.grupos.
DROP POLICY IF EXISTS "Teachers insert broadcast dashboard_notifications" ON public.dashboard_notifications;

CREATE POLICY "Teachers insert broadcast dashboard_notifications"
  ON public.dashboard_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND recipient_user_id IS NULL
    AND notification_type IN ('info', 'urgent')
    AND (
      (student_id IS NULL AND group_id IS NULL)
      OR (
        group_id IS NOT NULL
        AND student_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.grupos g
          WHERE g.id = group_id
            AND g.user_id = auth.uid()
        )
      )
      OR (
        student_id IS NOT NULL
        AND group_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.school_students ss
          INNER JOIN public.grupos g ON g.id = ss.school_group_id
          WHERE ss.id = student_id
            AND g.user_id = auth.uid()
        )
      )
    )
  );

COMMENT ON TABLE public.dashboard_notifications IS
  'In-app alerts for teachers. recipient_user_id NULL + no target = all teachers; group_id/student_id = assigned teachers only (see RLS).';
