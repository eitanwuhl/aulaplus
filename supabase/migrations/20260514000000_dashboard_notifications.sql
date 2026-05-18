-- Dashboard alerts for teachers (distinct from "comunicaciones", which is teacher → leadership outbox).

CREATE TABLE public.dashboard_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL CHECK (notification_type IN ('info', 'urgent')),
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  student_id integer NULL,
  group_id text NULL,
  recipient_user_id uuid NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT dashboard_notifications_one_target CHECK (student_id IS NULL OR group_id IS NULL)
);

COMMENT ON TABLE public.dashboard_notifications IS 'In-app alerts shown on the teacher dashboard; recipient_user_id NULL = all teachers.';
COMMENT ON COLUMN public.dashboard_notifications.recipient_user_id IS 'If set, only that user sees the row; if NULL, any teacher (see RLS).';

CREATE TABLE public.dashboard_notification_reads (
  notification_id uuid NOT NULL REFERENCES public.dashboard_notifications (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

COMMENT ON TABLE public.dashboard_notification_reads IS 'Per-user read state for dashboard_notifications.';

CREATE INDEX idx_dashboard_notifications_created_at ON public.dashboard_notifications (created_at DESC);
CREATE INDEX idx_dashboard_notification_reads_user ON public.dashboard_notification_reads (user_id);

ALTER TABLE public.dashboard_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_notification_reads ENABLE ROW LEVEL SECURITY;

-- Teachers: see broadcast (recipient null) or personal (recipient = self)
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
    AND (recipient_user_id IS NULL OR recipient_user_id = auth.uid())
  );

-- No direct inserts from the app for now (data via seeds / admin / future Edge Function)
CREATE POLICY "No insert dashboard_notifications from clients"
  ON public.dashboard_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "No update dashboard_notifications from clients"
  ON public.dashboard_notifications
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "No delete dashboard_notifications from clients"
  ON public.dashboard_notifications
  FOR DELETE
  TO authenticated
  USING (false);

CREATE POLICY "Teachers select own dashboard_notification_reads"
  ON public.dashboard_notification_reads
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Teachers insert own dashboard_notification_reads"
  ON public.dashboard_notification_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Teachers update own dashboard_notification_reads"
  ON public.dashboard_notification_reads
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Teachers delete own dashboard_notification_reads"
  ON public.dashboard_notification_reads
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.dashboard_notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_notification_reads TO authenticated;

-- Demo rows (idempotent; mirrors supabase/seeds/dashboard_notifications_demo.sql)
INSERT INTO public.dashboard_notifications (
  id,
  notification_type,
  title,
  message,
  created_at,
  student_id,
  group_id,
  recipient_user_id
)
VALUES
  (
    'a1000000-0000-4000-8000-000000000001'::uuid,
    'info',
    'Comunicacion de la psicopedagoga',
    'Se actualizo el informe de Santiago Perez. Ver informe actualizado y sugerencias en el perfil del alumno',
    now() - interval '30 minutes',
    9,
    NULL,
    NULL
  ),
  (
    'a1000000-0000-4000-8000-000000000002'::uuid,
    'urgent',
    'Comunicacion del equipo directivo',
    'Ana Rodriguez sera sometida a cirugia de vegetaciones que incide en su audicion actual. Ubicarla en la primera fila',
    now() - interval '2 hours',
    1,
    NULL,
    NULL
  ),
  (
    'a1000000-0000-4000-8000-000000000003'::uuid,
    'info',
    'Mensaje del equipo directivo',
    'Carlos Martinez viajara representando a Uruguay a Brasil entre el 15-22 de diciembre. No marcar inasistencias ni evaluaciones en ese periodo',
    now() - interval '4 hours',
    NULL,
    NULL,
    NULL
  ),
  (
    'a1000000-0000-4000-8000-000000000004'::uuid,
    'info',
    'Comunicacion de grupo',
    'Se actualizaron datos de seguimiento del grupo 9no 1',
    now() - interval '1 day',
    NULL,
    '1',
    NULL
  )
ON CONFLICT (id) DO NOTHING;
