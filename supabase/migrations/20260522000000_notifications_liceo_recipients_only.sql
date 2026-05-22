-- Notifications visible and publishable only within the sender's liceo (school_id).
-- Recipients: all docentes/staff of that school (broadcast), or assigned docentes (group/student).

-- Ensure tenant column is populated
UPDATE public.dashboard_notifications dn
SET school_id = ss.school_id
FROM public.school_students ss
WHERE dn.student_id = ss.id
  AND (dn.school_id IS NULL OR dn.school_id IS DISTINCT FROM ss.school_id);

UPDATE public.dashboard_notifications dn
SET school_id = sg.school_id
FROM public.school_groups sg
WHERE dn.group_id IS NOT NULL
  AND dn.group_id = sg.id
  AND (dn.school_id IS NULL OR dn.school_id IS DISTINCT FROM sg.school_id);

UPDATE public.dashboard_notifications
SET school_id = 'liceo-demo'
WHERE school_id IS NULL
  AND student_id IS NULL
  AND group_id IS NULL;

-- Catalog readable only for publishers within their liceo
DROP POLICY IF EXISTS "Teachers select own school_groups" ON public.school_groups;
DROP POLICY IF EXISTS "Publishers select school_groups" ON public.school_groups;
CREATE POLICY "Publishers select own school_groups"
  ON public.school_groups
  FOR SELECT
  TO authenticated
  USING (
    public.profile_role_is_notification_publisher()
    AND school_id = public.current_user_school_id()
  );

DROP POLICY IF EXISTS "Teachers select own school_students" ON public.school_students;
DROP POLICY IF EXISTS "Publishers select school_students" ON public.school_students;
CREATE POLICY "Publishers select own school_students"
  ON public.school_students
  FOR SELECT
  TO authenticated
  USING (
    public.profile_role_is_notification_publisher()
    AND school_id = public.current_user_school_id()
  );

-- ── SELECT: only same-liceo recipients ──
DROP POLICY IF EXISTS "Teachers select visible dashboard_notifications" ON public.dashboard_notifications;
DROP POLICY IF EXISTS "Publishers select visible dashboard_notifications" ON public.dashboard_notifications;
DROP POLICY IF EXISTS "Liceo members select dashboard_notifications" ON public.dashboard_notifications;

CREATE POLICY "Liceo members select dashboard_notifications"
  ON public.dashboard_notifications
  FOR SELECT
  TO authenticated
  USING (
    school_id IS NOT NULL
    AND school_id = public.current_user_school_id()
    AND (
      recipient_user_id = auth.uid()
      OR (
        recipient_user_id IS NULL
        AND public.profile_role_is_notification_staff()
      )
      OR (
        recipient_user_id IS NULL
        AND public.profile_role_is_teacher()
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

-- ── INSERT: publish only within own liceo ──
DROP POLICY IF EXISTS "Teachers insert broadcast dashboard_notifications" ON public.dashboard_notifications;
DROP POLICY IF EXISTS "Publishers insert dashboard_notifications" ON public.dashboard_notifications;
DROP POLICY IF EXISTS "Liceo publishers insert dashboard_notifications" ON public.dashboard_notifications;

CREATE POLICY "Liceo publishers insert dashboard_notifications"
  ON public.dashboard_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND recipient_user_id IS NULL
    AND notification_type IN ('info', 'urgent')
    AND school_id IS NOT NULL
    AND school_id = public.current_user_school_id()
    AND public.profile_role_is_notification_publisher()
    AND (student_id IS NULL OR group_id IS NULL)
    AND (
      public.profile_role_is_notification_staff()
      AND (
        (student_id IS NULL AND group_id IS NULL)
        OR (
          group_id IS NOT NULL
          AND student_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.school_groups sg
            WHERE sg.id = group_id
              AND sg.school_id = school_id
          )
        )
        OR (
          student_id IS NOT NULL
          AND group_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.school_students ss
            WHERE ss.id = student_id
              AND ss.school_id = school_id
          )
        )
      )
      OR (
        public.profile_role_is_teacher()
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
      )
    )
  );

COMMENT ON POLICY "Liceo members select dashboard_notifications" ON public.dashboard_notifications IS
  'Broadcast/grupo/alumno: solo usuarios con profiles.school_id = notification.school_id. Staff ve todo el liceo; docentes broadcast del liceo o avisos de sus cursos.';
