-- Catálogo Liceo St. Patrick's (tenant liceo-st-patricks).
-- Re-run: npm run seed:school-catalog

INSERT INTO public.schools (id, name, slug)
VALUES ('liceo-st-patricks', 'Liceo St. Patrick''s', 'liceo-st-patricks')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug;

INSERT INTO public.school_groups (school_id, id, name, year, section)
VALUES
  ('liceo-st-patricks', '1', '10mo 1', '10º Año', '1'),
  ('liceo-st-patricks', '2', '10mo 2', '10º Año', '2'),
  ('liceo-st-patricks', '3', '10mo 3', '10º Año', '3')
ON CONFLICT (school_id, id) DO UPDATE SET
  name = EXCLUDED.name,
  year = EXCLUDED.year,
  section = EXCLUDED.section;

INSERT INTO public.school_students (id, school_id, school_group_id, display_name, perfil)
VALUES
  (301, 'liceo-st-patricks', '1', 'Olivia Murphy', 'Visual-Lector/escritor'),
  (302, 'liceo-st-patricks', '1', 'James O''Connor', 'Auditivo-Kinestésico'),
  (303, 'liceo-st-patricks', '2', 'Sophie Walsh', 'Kinestésico-Visual'),
  (304, 'liceo-st-patricks', '2', 'Liam Byrne', 'Lector/escritor-Auditivo'),
  (305, 'liceo-st-patricks', '3', 'Emma Fitzgerald', 'Visual-Auditivo'),
  (306, 'liceo-st-patricks', '3', 'Noah Gallagher', 'Auditivo-Lector/escritor')
ON CONFLICT (id) DO UPDATE SET
  school_id = EXCLUDED.school_id,
  school_group_id = EXCLUDED.school_group_id,
  display_name = EXCLUDED.display_name,
  perfil = EXCLUDED.perfil;
