-- Foundation security tests. Intended to run as a privileged role, then SET ROLE authenticated.
-- Cleanup uses the agende.test email suffix.

CREATE SCHEMA IF NOT EXISTS test_helpers;

CREATE OR REPLACE FUNCTION test_helpers.login_as(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
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
    is_anonymous
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
    encode(extensions.gen_random_bytes(16), 'hex'),
    '',
    '',
    '',
    false,
    false
  );
  RETURN v_id;
END;
$$;
