-- Demo login: teacher code → auth email mapping; student code + password (bcrypt via pgcrypto).
-- RPCs are SECURITY DEFINER so anon can validate without SELECT on the tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.demo_teacher_credentials (
  login_code text PRIMARY KEY,
  auth_email text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.student_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_teacher_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_accounts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.demo_teacher_credentials FROM PUBLIC;
REVOKE ALL ON public.student_accounts FROM PUBLIC;
REVOKE ALL ON public.demo_teacher_credentials FROM anon, authenticated;
REVOKE ALL ON public.student_accounts FROM anon, authenticated;

-- Demo rows: run separately (any time, idempotent): npm run seed:login
-- Or included in local reset via supabase/seed.sql

CREATE OR REPLACE FUNCTION public.get_teacher_login_email(p_code text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT dt.auth_email
  FROM public.demo_teacher_credentials dt
  WHERE upper(trim(dt.login_code)) = upper(trim(p_code))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.verify_student_login(p_student_code text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r RECORD;
BEGIN
  IF p_student_code IS NULL OR trim(p_student_code) = '' OR p_password IS NULL OR p_password = '' THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT sa.id, sa.display_name INTO r
  FROM public.student_accounts sa
  WHERE lower(trim(sa.student_code)) = lower(trim(p_student_code))
    AND sa.password_hash = extensions.crypt(p_password, sa.password_hash)
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'student_id', r.id::text,
      'display_name', coalesce(r.display_name, 'Estudiante')
    );
  END IF;

  RETURN jsonb_build_object('ok', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_login_email(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_student_login(text, text) TO anon, authenticated;
