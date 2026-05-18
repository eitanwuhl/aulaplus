-- Multiple teachers can be assigned the same school group (e.g. co-teaching).
-- Publishers: profiles.role in (teacher, direccion, psicopedagogico).

ALTER TABLE public.grupos DROP CONSTRAINT IF EXISTS grupos_pkey;
ALTER TABLE public.grupos ADD PRIMARY KEY (user_id, id);

COMMENT ON TABLE public.grupos IS
  'Per-teacher assignment to a catalog group (school_groups.id). Composite PK (user_id, id).';

CREATE OR REPLACE FUNCTION public.profile_role_is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.user_id = auth.uid()
      AND COALESCE(pr.role, '') = 'teacher'
  );
$$;

CREATE OR REPLACE FUNCTION public.profile_role_is_notification_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.user_id = auth.uid()
      AND COALESCE(pr.role, '') IN ('direccion', 'psicopedagogico')
  );
$$;

CREATE OR REPLACE FUNCTION public.profile_role_is_notification_publisher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.profile_role_is_teacher()
    OR public.profile_role_is_notification_staff();
$$;

GRANT EXECUTE ON FUNCTION public.profile_role_is_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_role_is_notification_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_role_is_notification_publisher() TO authenticated;

-- Catalog readable by teachers (assigned workflows) and staff (publish targeted avisos).
DROP POLICY IF EXISTS "Teachers select school_groups" ON public.school_groups;
CREATE POLICY "Publishers select school_groups"
  ON public.school_groups
  FOR SELECT
  TO authenticated
  USING (public.profile_role_is_notification_publisher());

DROP POLICY IF EXISTS "Teachers select school_students" ON public.school_students;
CREATE POLICY "Publishers select school_students"
  ON public.school_students
  FOR SELECT
  TO authenticated
  USING (public.profile_role_is_notification_publisher());

DROP POLICY IF EXISTS "Teachers select visible dashboard_notifications" ON public.dashboard_notifications;

CREATE POLICY "Publishers select visible dashboard_notifications"
  ON public.dashboard_notifications
  FOR SELECT
  TO authenticated
  USING (
    recipient_user_id = auth.uid()
    OR public.profile_role_is_notification_staff()
    OR (
      public.profile_role_is_teacher()
      AND recipient_user_id IS NULL
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
            INNER JOIN public.grupos g ON g.id = ss.school_group_id AND g.user_id = auth.uid()
            WHERE ss.id = dashboard_notifications.student_id
          )
        )
      )
    )
  );

DROP POLICY IF EXISTS "Teachers insert broadcast dashboard_notifications" ON public.dashboard_notifications;

CREATE POLICY "Publishers insert dashboard_notifications"
  ON public.dashboard_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND recipient_user_id IS NULL
    AND notification_type IN ('info', 'urgent')
    AND (student_id IS NULL OR group_id IS NULL)
    AND public.profile_role_is_notification_publisher()
    AND (
      public.profile_role_is_notification_staff()
      OR (student_id IS NULL AND group_id IS NULL)
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
          INNER JOIN public.grupos g ON g.id = ss.school_group_id AND g.user_id = auth.uid()
          WHERE ss.id = student_id
        )
      )
    )
  );

GRANT INSERT ON public.dashboard_notifications TO authenticated;
