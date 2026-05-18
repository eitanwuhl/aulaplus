-- Fix INSERT RLS: previous policy required profiles.role = 'teacher', which fails if the
-- profile row is missing (common right after first login). In this app only teachers use
-- Supabase Auth sessions; students use local storage only.

DROP POLICY IF EXISTS "No insert dashboard_notifications from clients" ON public.dashboard_notifications;
DROP POLICY IF EXISTS "Teachers insert broadcast dashboard_notifications" ON public.dashboard_notifications;

CREATE POLICY "Teachers insert broadcast dashboard_notifications"
  ON public.dashboard_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND recipient_user_id IS NULL
    AND notification_type IN ('info', 'urgent')
  );

GRANT INSERT ON public.dashboard_notifications TO authenticated;
