-- Notificaciones demo — Liceo St. Patrick's

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
    'c1000000-0000-4000-8000-000000000001'::uuid,
    'info',
    'Coordinación bilingüe',
    'Se actualizó el plan de acompañamiento de Olivia Murphy. Revisar perfil del alumno.',
    now() - interval '20 minutes',
    301,
    NULL,
    'liceo-st-patricks',
    NULL
  ),
  (
    'c1000000-0000-4000-8000-000000000002'::uuid,
    'urgent',
    'Dirección — St. Patrick''s',
    'James O''Connor requiere adaptación de evaluación oral para la próxima semana.',
    now() - interval '2 hours',
    302,
    NULL,
    'liceo-st-patricks',
    NULL
  ),
  (
    'c1000000-0000-4000-8000-000000000003'::uuid,
    'info',
    'Comunicación 10mo 2',
    'Reunión de padres del 10mo 2 — jueves 17:30 en salón 4B.',
    now() - interval '5 hours',
    NULL,
    '2',
    'liceo-st-patricks',
    NULL
  )
ON CONFLICT (id) DO UPDATE SET
  notification_type = EXCLUDED.notification_type,
  title = EXCLUDED.title,
  message = EXCLUDED.message,
  student_id = EXCLUDED.student_id,
  group_id = EXCLUDED.group_id,
  school_id = EXCLUDED.school_id;
