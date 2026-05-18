-- INSERT: any authenticated teacher can create avisos (FK validates catalog ids).
-- SELECT (20260516120000): group/student avisos only visible to teachers assigned in public.grupos.

DROP POLICY IF EXISTS "Teachers insert broadcast dashboard_notifications" ON public.dashboard_notifications;

CREATE POLICY "Teachers insert broadcast dashboard_notifications"
  ON public.dashboard_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND recipient_user_id IS NULL
    AND notification_type IN ('info', 'urgent')
    AND (student_id IS NULL OR group_id IS NULL)
  );

GRANT INSERT ON public.dashboard_notifications TO authenticated;
