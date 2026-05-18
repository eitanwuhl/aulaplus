-- Idempotent catalog seed (groups + students from mockData). Safe to re-run on remote via npm run seed:school-catalog.

INSERT INTO public.school_groups (id, name, year, section)
VALUES
  ('1', '9no 1', '9º Año', '1'),
  ('2', '9no 2', '9º Año', '2'),
  ('3', '9no 3', '9º Año', '3')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  year = EXCLUDED.year,
  section = EXCLUDED.section;

INSERT INTO public.school_students (id, school_group_id, display_name, perfil)
VALUES
  (1, '1', 'Ana García', 'Visual-Kinestésico'),
  (2, '1', 'Carlos López', 'Auditivo-Lector/escritor'),
  (3, '1', 'María Rodríguez', 'Visual-Lector/escritor'),
  (4, '1', 'Diego Martínez', 'Kinestésico-Visual'),
  (5, '1', 'Sofía Fernández', 'Lector/escritor-Auditivo'),
  (6, '1', 'Joaquín Torres', 'Auditivo-Kinestésico'),
  (7, '1', 'Valentina Castro', 'Visual-Auditivo'),
  (8, '1', 'Mateo Silva', 'Kinestésico-Lector/escritor'),
  (9, '1', 'Isabella Morales', 'Visual-Lector/escritor'),
  (10, '1', 'Luciano Vega', 'Auditivo-Visual')
ON CONFLICT (id) DO UPDATE SET
  school_group_id = EXCLUDED.school_group_id,
  display_name = EXCLUDED.display_name,
  perfil = EXCLUDED.perfil;
