-- Align catalog with seeds: students in groups 1, 2 and 3 (idempotent).

INSERT INTO public.school_students (id, school_group_id, display_name, perfil)
VALUES
  (1, '1', 'Ana García', 'Visual-Kinestésico'),
  (2, '1', 'Carlos López', 'Auditivo-Lector/escritor'),
  (3, '1', 'María Rodríguez', 'Visual-Lector/escritor'),
  (4, '1', 'Diego Martínez', 'Kinestésico-Visual'),
  (5, '2', 'Sofía Fernández', 'Lector/escritor-Auditivo'),
  (6, '2', 'Joaquín Torres', 'Auditivo-Kinestésico'),
  (7, '2', 'Valentina Castro', 'Visual-Auditivo'),
  (8, '3', 'Mateo Silva', 'Kinestésico-Lector/escritor'),
  (9, '3', 'Isabella Morales', 'Visual-Lector/escritor'),
  (10, '3', 'Luciano Vega', 'Auditivo-Visual')
ON CONFLICT (id) DO UPDATE SET
  school_group_id = EXCLUDED.school_group_id,
  display_name = EXCLUDED.display_name,
  perfil = EXCLUDED.perfil;
