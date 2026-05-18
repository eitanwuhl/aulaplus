-- Asignación docente ↔ curso (public.grupos). Requiere auth.users + school_groups.
-- Re-run: npm run seed:teacher-grupos
--
-- demo.teacher@example.com  → 9no 1 y 9no 2
-- demo.teacher2@example.com → 9no 2 y 9no 3
-- demo.teacher3@example.com → 9no 1 y 9no 3

INSERT INTO public.grupos (id, name, year, section, user_id)
SELECT sg.id, sg.name, sg.year, sg.section, u.id
FROM public.school_groups sg
JOIN auth.users u ON u.email = 'demo.teacher@example.com'
WHERE sg.id IN ('1', '2')
ON CONFLICT (user_id, id) DO UPDATE SET
  name = EXCLUDED.name,
  year = EXCLUDED.year,
  section = EXCLUDED.section;

INSERT INTO public.grupos (id, name, year, section, user_id)
SELECT sg.id, sg.name, sg.year, sg.section, u.id
FROM public.school_groups sg
JOIN auth.users u ON u.email = 'demo.teacher2@example.com'
WHERE sg.id IN ('2', '3')
ON CONFLICT (user_id, id) DO UPDATE SET
  name = EXCLUDED.name,
  year = EXCLUDED.year,
  section = EXCLUDED.section;

INSERT INTO public.grupos (id, name, year, section, user_id)
SELECT sg.id, sg.name, sg.year, sg.section, u.id
FROM public.school_groups sg
JOIN auth.users u ON u.email = 'demo.teacher3@example.com'
WHERE sg.id IN ('1', '3')
ON CONFLICT (user_id, id) DO UPDATE SET
  name = EXCLUDED.name,
  year = EXCLUDED.year,
  section = EXCLUDED.section;
