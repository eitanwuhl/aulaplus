-- Demo dashboard notifications (same rows as migration 20260514000000_dashboard_notifications.sql tail).
-- Idempotent for `supabase db reset` after migrations already inserted them.

INSERT INTO public.dashboard_notifications (
  id,
  notification_type,
  title,
  message,
  created_at,
  student_id,
  group_id,
  school_id,
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
    'liceo-demo',
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
    'liceo-demo',
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
    'liceo-demo',
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
    'liceo-demo',
    NULL
  )
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  student_id = EXCLUDED.student_id,
  group_id = EXCLUDED.group_id;
