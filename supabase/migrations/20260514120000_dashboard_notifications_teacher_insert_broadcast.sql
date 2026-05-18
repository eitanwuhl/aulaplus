-- Allow teachers to create broadcast dashboard notifications from the app (recipient_user_id must stay NULL).
-- Targeted notifications (recipient_user_id set) remain seed/service-role only.

DROP POLICY IF EXISTS "No insert dashboard_notifications from clients" ON public.dashboard_notifications;

CREATE POLICY "Teachers insert broadcast dashboard_notifications"
  ON public.dashboard_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.user_id = auth.uid()
        AND COALESCE(pr.role, '') = 'teacher'
    )
    AND recipient_user_id IS NULL
    AND notification_type IN ('info', 'urgent')
  );

GRANT INSERT ON public.dashboard_notifications TO authenticated;
