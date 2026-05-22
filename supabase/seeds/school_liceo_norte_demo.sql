-- Catálogo del tenant liceo-norte (aislado de liceo-demo).
-- Re-run: npm run seed:school-norte (o incluido en db push vía migración).

INSERT INTO public.school_groups (school_id, id, name, year, section)
VALUES
  ('liceo-norte', '1', '8vo 1', '8º Año', '1'),
  ('liceo-norte', '2', '8vo 2', '8º Año', '2')
ON CONFLICT (school_id, id) DO UPDATE SET
  name = EXCLUDED.name,
  year = EXCLUDED.year,
  section = EXCLUDED.section;

INSERT INTO public.school_students (id, school_id, school_group_id, display_name, perfil)
VALUES
  (201, 'liceo-norte', '1', 'Renata Pérez', 'Visual-Kinestésico'),
  (202, 'liceo-norte', '1', 'Tomás Acosta', 'Auditivo-Lector/escritor'),
  (203, 'liceo-norte', '2', 'Emilia Ruiz', 'Kinestésico-Visual'),
  (204, 'liceo-norte', '2', 'Benjamín Costa', 'Lector/escritor-Auditivo')
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  school_group_id = EXCLUDED.school_group_id,
  display_name = EXCLUDED.display_name,
  perfil = EXCLUDED.perfil;
