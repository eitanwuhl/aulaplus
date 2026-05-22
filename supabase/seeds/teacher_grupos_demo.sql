-- Asignación docente ↔ curso (public.grupos). Requiere auth.users + school_groups.
-- Re-run: npm run seed:teacher-grupos
--
-- DOC001 / demo.teacher@example.com     → liceo-demo: 9no 1 y 9no 2
-- DOC002 / demo.teacher2@example.com    → liceo-norte: 8vo 1 y 8vo 2
-- DOC003 / demo.teacher3@example.com    → liceo-demo: 9no 1 y 9no 3
-- DOC004 / demo.teacher4@example.com    → St. Patrick's: 10mo 1 y 10mo 2
-- DOC005 / demo.teacher5@example.com    → St. Patrick's: 10mo 2 y 10mo 3

-- DOC001 / demo.teacher → liceo-demo
INSERT INTO public.grupos (id, name, year, section, user_id)
SELECT sg.id, sg.name, sg.year, sg.section, u.id
FROM public.school_groups sg
JOIN auth.users u ON u.email = 'demo.teacher@example.com'
JOIN public.profiles p ON p.user_id = u.id AND p.school_id = sg.school_id
WHERE sg.school_id = 'liceo-demo' AND sg.id IN ('1', '2')
ON CONFLICT (user_id, id) DO UPDATE SET
  name = EXCLUDED.name,
  year = EXCLUDED.year,
  section = EXCLUDED.section;

-- DOC002 / demo.teacher2 → liceo-norte
INSERT INTO public.grupos (id, name, year, section, user_id)
SELECT sg.id, sg.name, sg.year, sg.section, u.id
FROM public.school_groups sg
JOIN auth.users u ON u.email = 'demo.teacher2@example.com'
JOIN public.profiles p ON p.user_id = u.id AND p.school_id = sg.school_id
WHERE sg.school_id = 'liceo-norte' AND sg.id IN ('1', '2')
ON CONFLICT (user_id, id) DO UPDATE SET
  name = EXCLUDED.name,
  year = EXCLUDED.year,
  section = EXCLUDED.section;

-- DOC003 / demo.teacher3 → liceo-demo
INSERT INTO public.grupos (id, name, year, section, user_id)
SELECT sg.id, sg.name, sg.year, sg.section, u.id
FROM public.school_groups sg
JOIN auth.users u ON u.email = 'demo.teacher3@example.com'
JOIN public.profiles p ON p.user_id = u.id AND p.school_id = sg.school_id
WHERE sg.school_id = 'liceo-demo' AND sg.id IN ('1', '3')
ON CONFLICT (user_id, id) DO UPDATE SET
  name = EXCLUDED.name,
  year = EXCLUDED.year,
  section = EXCLUDED.section;

-- DOC004 / demo.teacher4 → Liceo St. Patrick's (10mo 1 y 2)
INSERT INTO public.grupos (id, name, year, section, user_id)
SELECT sg.id, sg.name, sg.year, sg.section, u.id
FROM public.school_groups sg
JOIN auth.users u ON u.email = 'demo.teacher4@example.com'
JOIN public.profiles p ON p.user_id = u.id AND p.school_id = sg.school_id
WHERE sg.school_id = 'liceo-st-patricks' AND sg.id IN ('1', '2')
ON CONFLICT (user_id, id) DO UPDATE SET
  name = EXCLUDED.name,
  year = EXCLUDED.year,
  section = EXCLUDED.section;

-- DOC005 / demo.teacher5 → Liceo St. Patrick's (10mo 2 y 3)
INSERT INTO public.grupos (id, name, year, section, user_id)
SELECT sg.id, sg.name, sg.year, sg.section, u.id
FROM public.school_groups sg
JOIN auth.users u ON u.email = 'demo.teacher5@example.com'
JOIN public.profiles p ON p.user_id = u.id AND p.school_id = sg.school_id
WHERE sg.school_id = 'liceo-st-patricks' AND sg.id IN ('2', '3')
ON CONFLICT (user_id, id) DO UPDATE SET
  name = EXCLUDED.name,
  year = EXCLUDED.year,
  section = EXCLUDED.section;
