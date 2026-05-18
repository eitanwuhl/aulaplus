-- Assign all catalog groups to the demo teacher so group-scoped notifications are visible after login.
-- Requires auth user demo.teacher@example.com (ensure-demo-users) and school_groups seed.

INSERT INTO public.grupos (id, name, year, section, user_id)
SELECT
  sg.id,
  sg.name,
  sg.year,
  sg.section,
  u.id
FROM public.school_groups sg
CROSS JOIN auth.users u
WHERE u.email = 'demo.teacher@example.com'
ON CONFLICT (user_id, id) DO UPDATE SET
  name = EXCLUDED.name,
  year = EXCLUDED.year,
  section = EXCLUDED.section;
