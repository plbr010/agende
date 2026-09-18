-- Setup helpers for foundation tests. Privileged connection required (postgres / service_role).
-- Safe to re-run. Does not grant EXECUTE to anon/authenticated.
--
-- Usage:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/helpers.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/foundation.sql

CREATE SCHEMA IF NOT EXISTS test_helpers;

CREATE OR REPLACE FUNCTION test_helpers.login_as(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', p_user_id,
      'role', 'authenticated',
      'email_verified', true
    )::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION test_helpers.become(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(p_user_id);
  EXECUTE 'SET ROLE authenticated';
END;
$$;

CREATE OR REPLACE FUNCTION test_helpers.reset_role()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  EXECUTE 'RESET ROLE';
END;
$$;

CREATE OR REPLACE FUNCTION test_helpers.assert_true(p_cond boolean, p_label text)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF p_cond IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: %', p_label;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION test_helpers.assert_eq(p_got anyelement, p_want anyelement, p_label text)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF p_got IS DISTINCT FROM p_want THEN
    RAISE EXCEPTION 'FAIL: % (got %, want %)', p_label, p_got, p_want;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS test_helpers.assert_error(text, text, text);

CREATE OR REPLACE FUNCTION test_helpers.assert_error(
  p_sql text,
  p_fragment text,
  p_label text,
  p_as_authenticated boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_caught boolean := false;
  v_msg text;
  v_state text;
BEGIN
  IF p_as_authenticated THEN
    EXECUTE 'SET ROLE authenticated';
  END IF;
  BEGIN
    EXECUTE p_sql;
  EXCEPTION
    WHEN OTHERS THEN
      v_caught := true;
      v_msg := SQLERRM;
      v_state := SQLSTATE;
  END;
  IF p_as_authenticated THEN
    EXECUTE 'RESET ROLE';
  END IF;

  IF NOT v_caught THEN
    RAISE EXCEPTION 'FAIL: % — expected error containing "%"', p_label, p_fragment;
  END IF;

  IF v_msg NOT ILIKE '%' || p_fragment || '%' AND v_state <> p_fragment THEN
    RAISE EXCEPTION 'FAIL: % — expected "%", got % (%)', p_label, p_fragment, v_msg, v_state;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION test_helpers.create_auth_user(
  p_email text,
  p_intended text,
  p_confirmed boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    is_sso_user,
    is_anonymous,
    phone_confirmed_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    lower(p_email),
    extensions.crypt('Passw0rd!', extensions.gen_salt('bf')),
    CASE WHEN p_confirmed THEN now() ELSE NULL END,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', 'Teste Agende',
      'phone', '+5532999999999',
      'intended_use', p_intended,
      'terms_accepted', true,
      'privacy_accepted', true
    ),
    now(),
    now(),
    '',
    '',
    '',
    '',
    false,
    false,
    NULL
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION test_helpers.cleanup(p_email_pattern text DEFAULT '%@agende-foundation.test')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  ALTER TABLE public.professional_trial_claims DISABLE TRIGGER professional_trial_claims_protect;

  DELETE FROM public.professional_trial_claims
  WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE p_email_pattern);

  DELETE FROM public.workspaces
  WHERE owner_user_id IN (SELECT id FROM auth.users WHERE email LIKE p_email_pattern);

  DELETE FROM auth.users WHERE email LIKE p_email_pattern;

  ALTER TABLE public.professional_trial_claims ENABLE TRIGGER professional_trial_claims_protect;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);
END;
$$;

REVOKE ALL ON SCHEMA test_helpers FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA test_helpers TO postgres, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA test_helpers TO postgres, service_role;
