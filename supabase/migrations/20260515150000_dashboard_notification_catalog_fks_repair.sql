-- No-op if 202605151400 completed cleanly. Repairs remotes where 202605151400 failed after creating
-- catalog tables but before student_id FK (e.g. orphan student_id=34 from manual tests).

UPDATE public.dashboard_notifications dn
SET student_id = NULL
WHERE dn.student_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.school_students ss
    WHERE ss.id = dn.student_id
  );

UPDATE public.dashboard_notifications dn
SET group_id = NULL
WHERE dn.group_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.school_groups sg
    WHERE sg.id = dn.group_id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dashboard_notifications_group_id_fkey'
      AND conrelid = 'public.dashboard_notifications'::regclass
  ) THEN
    ALTER TABLE public.dashboard_notifications
      ADD CONSTRAINT dashboard_notifications_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES public.school_groups (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dashboard_notifications_student_id_fkey'
      AND conrelid = 'public.dashboard_notifications'::regclass
  ) THEN
    ALTER TABLE public.dashboard_notifications
      ADD CONSTRAINT dashboard_notifications_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES public.school_students (id) ON DELETE SET NULL;
  END IF;
END $$;
