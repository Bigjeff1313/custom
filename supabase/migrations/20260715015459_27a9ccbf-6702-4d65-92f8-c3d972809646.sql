CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

DO $$
DECLARE
  _policy record;
BEGIN
  FOR _policy IN
    SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual ILIKE '%has_role%' OR with_check ILIKE '%has_role%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', _policy.policyname, _policy.schemaname, _policy.tablename);

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR %s TO %s %s %s',
      _policy.policyname,
      _policy.schemaname,
      _policy.tablename,
      _policy.cmd,
      array_to_string(_policy.roles, ', '),
      CASE WHEN _policy.qual IS NOT NULL
        THEN 'USING (' || regexp_replace(_policy.qual, '(public\.)?has_role', 'private.has_role', 'gi') || ')'
        ELSE ''
      END,
      CASE WHEN _policy.with_check IS NOT NULL
        THEN 'WITH CHECK (' || regexp_replace(_policy.with_check, '(public\.)?has_role', 'private.has_role', 'gi') || ')'
        ELSE ''
      END
    );
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;