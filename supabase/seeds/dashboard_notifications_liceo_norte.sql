-- Notificaciones demo para liceo-norte (DOC002 / grupos 8vo).
-- Requiere migración multi-tenant (school_id en dashboard_notifications).

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
    'b1000000-0000-4000-8000-000000000001'::uuid,
    'info',
    'Seguimiento psicopedagógico',
    'Se actualizó el informe de Renata Pérez. Revisar sugerencias en el perfil del alumno.',
    now() - interval '45 minutes',
    201,
    NULL,
    'liceo-norte',
    NULL
  ),
  (
    'b1000000-0000-4000-8000-000000000002'::uuid,
    'urgent',
    'Equipo directivo — Liceo Norte',
    'Tomás Acosta requiere ubicación preferencial por hipoacusia temporal.',
    now() - interval '3 hours',
    202,
    NULL,
    'liceo-norte',
    NULL
  ),
  (
    'b1000000-0000-4000-8000-000000000003'::uuid,
    'info',
    'Comunicación de grupo 8vo 2',
    'Reunión de padres del 8vo 2 — viernes 18:00 en sala 12.',
    now() - interval '6 hours',
    NULL,
    '2',
    'liceo-norte',
    NULL
  )
ON CONFLICT (id) DO UPDATE SET
  notification_type = EXCLUDED.notification_type,
  title = EXCLUDED.title,
  message = EXCLUDED.message,
  student_id = EXCLUDED.student_id,
  group_id = EXCLUDED.group_id,
  school_id = EXCLUDED.school_id;
