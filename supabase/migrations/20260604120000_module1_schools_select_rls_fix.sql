-- Module 1 hardening: restrict schools SELECT to current tenant only.
-- Previous policy allowed broad reads; this restores school-level isolation.

DROP POLICY IF EXISTS "Authenticated users select schools" ON public.schools;

CREATE POLICY "Authenticated users select schools"
  ON public.schools
  FOR SELECT
  TO authenticated
  USING (id = public.current_user_school_id());
