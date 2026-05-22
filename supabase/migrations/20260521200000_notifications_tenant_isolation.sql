-- Strict tenant isolation for dashboard_notifications (no cross-liceo visibility).
-- NOTE: Final SELECT/INSERT policies are defined in 20260522000000_notifications_liceo_recipients_only.sql.

-- Backfill legacy rows without school_id (default to liceo-demo catalog).
UPDATE public.dashboard_notifications dn
SET school_id = ss.school_id
FROM public.school_students ss
WHERE dn.student_id = ss.id
  AND dn.school_id IS NULL;

UPDATE public.dashboard_notifications dn
SET school_id = sg.school_id
FROM public.school_groups sg
WHERE dn.group_id = sg.id
  AND dn.school_id IS NULL;

UPDATE public.dashboard_notifications
SET school_id = 'liceo-demo'
WHERE school_id IS NULL
  AND student_id IS NULL
  AND group_id IS NULL;

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
    AND dashboard_notifications.school_id = public.current_user_school_id()
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
              INNER JOIN public.school_groups sg
                ON sg.id = g.id AND sg.school_id = dashboard_notifications.school_id
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
              INNER JOIN public.grupos g
                ON g.id = ss.school_group_id AND g.user_id = auth.uid()
              WHERE ss.id = dashboard_notifications.student_id
                AND ss.school_id = dashboard_notifications.school_id
            )
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "Teachers insert broadcast dashboard_notifications" ON public.dashboard_notifications;

CREATE POLICY "Teachers insert broadcast dashboard_notifications"
  ON public.dashboard_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND recipient_user_id IS NULL
    AND notification_type IN ('info', 'urgent')
    AND school_id = public.current_user_school_id()
    AND (
      (student_id IS NULL AND group_id IS NULL)
      OR (
        group_id IS NOT NULL
        AND student_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.grupos g
          INNER JOIN public.school_groups sg
            ON sg.id = g.id AND sg.school_id = school_id
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
          INNER JOIN public.grupos g
            ON g.id = ss.school_group_id AND g.user_id = auth.uid()
          WHERE ss.id = student_id
            AND ss.school_id = school_id
        )
      )
    )
  );

COMMENT ON COLUMN public.dashboard_notifications.school_id IS
  'Tenant (liceo). Required for teacher-visible notifications; must match profiles.school_id.';
