-- Module 1 post-piloto: admin write on school catalogs + student_frameworks

-- ── curriculum_catalog_items: admin CRUD on own-school catalogs ──
DROP POLICY IF EXISTS "Admin insert curriculum_catalog_items" ON public.curriculum_catalog_items;
CREATE POLICY "Admin insert curriculum_catalog_items"
  ON public.curriculum_catalog_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.curriculum_catalogs c
      WHERE c.id = curriculum_catalog_items.catalog_id
        AND c.school_id = public.current_user_school_id()
        AND public.profile_role_is_institution_admin()
    )
  );

DROP POLICY IF EXISTS "Admin update curriculum_catalog_items" ON public.curriculum_catalog_items;
CREATE POLICY "Admin update curriculum_catalog_items"
  ON public.curriculum_catalog_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.curriculum_catalogs c
      WHERE c.id = curriculum_catalog_items.catalog_id
        AND c.school_id = public.current_user_school_id()
        AND public.profile_role_is_institution_admin()
    )
  );

DROP POLICY IF EXISTS "Admin delete curriculum_catalog_items" ON public.curriculum_catalog_items;
CREATE POLICY "Admin delete curriculum_catalog_items"
  ON public.curriculum_catalog_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.curriculum_catalogs c
      WHERE c.id = curriculum_catalog_items.catalog_id
        AND c.school_id = public.current_user_school_id()
        AND public.profile_role_is_institution_admin()
    )
  );

-- ── school_students: admin updates student_frameworks ──
DROP POLICY IF EXISTS "Admin update school_students frameworks" ON public.school_students;
CREATE POLICY "Admin update school_students frameworks"
  ON public.school_students
  FOR UPDATE
  TO authenticated
  USING (
    school_id = public.current_user_school_id()
    AND public.profile_role_is_institution_admin()
  )
  WITH CHECK (school_id = public.current_user_school_id());
