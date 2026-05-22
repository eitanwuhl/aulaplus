-- Catálogo escolar (grupos + alumnos). Re-run: npm run seed:school-catalog
-- 10 alumnos repartidos en los 3 grupos (ya no solo 9no 1).

INSERT INTO public.school_groups (school_id, id, name, year, section)
VALUES
  ('liceo-demo', '1', '9no 1', '9º Año', '1'),
  ('liceo-demo', '2', '9no 2', '9º Año', '2'),
  ('liceo-demo', '3', '9no 3', '9º Año', '3')
ON CONFLICT (school_id, id) DO UPDATE SET
  name = EXCLUDED.name,
  year = EXCLUDED.year,
  section = EXCLUDED.section;

INSERT INTO public.school_students (id, school_id, school_group_id, display_name, perfil)
VALUES
  (1, 'liceo-demo', '1', 'Ana García', 'Visual-Kinestésico'),
  (2, 'liceo-demo', '1', 'Carlos López', 'Auditivo-Lector/escritor'),
  (3, 'liceo-demo', '1', 'María Rodríguez', 'Visual-Lector/escritor'),
  (4, 'liceo-demo', '1', 'Diego Martínez', 'Kinestésico-Visual'),
  (5, 'liceo-demo', '2', 'Sofía Fernández', 'Lector/escritor-Auditivo'),
  (6, 'liceo-demo', '2', 'Joaquín Torres', 'Auditivo-Kinestésico'),
  (7, 'liceo-demo', '2', 'Valentina Castro', 'Visual-Auditivo'),
  (8, 'liceo-demo', '3', 'Mateo Silva', 'Kinestésico-Lector/escritor'),
  (9, 'liceo-demo', '3', 'Isabella Morales', 'Visual-Lector/escritor'),
  (10, 'liceo-demo', '3', 'Luciano Vega', 'Auditivo-Visual')
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  school_group_id = EXCLUDED.school_group_id,
  display_name = EXCLUDED.display_name,
  perfil = EXCLUDED.perfil;
