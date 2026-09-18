-- Foundation hardening (part 3): invite email bind, public wrappers, least-privilege GRANTs.
-- Companion to 20260918183729 and 20260918183827. Does not rewrite previously applied migrations.

CREATE OR REPLACE FUNCTION app.create_workspace_invite(
  p_workspace_id uuid,
  p_role public.member_role,
  p_email text DEFAULT NULL,
  p_ttl interval DEFAULT interval '7 days'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_email text;
  v_token text;
  v_hash text;
  v_invite public.workspace_invites;
BEGIN
  v_uid := app.require_confirmed_email();

  IF NOT app.has_workspace_role(p_workspace_id, VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_role IS NULL OR p_role = 'owner' THEN
    RAISE EXCEPTION 'invalid_invite_role' USING ERRCODE = '22023';
  END IF;

  IF p_role IN ('admin', 'professional') THEN
    PERFORM app.assert_professional_seat_available(p_workspace_id);
  ELSE
    PERFORM app.lock_workspace_billing(p_workspace_id);
  END IF;

  v_email := CASE WHEN p_email IS NULL THEN NULL ELSE lower(btrim(p_email)) END;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.workspace_invites (
    workspace_id, email, role, token_hash, expires_at, created_by
  ) VALUES (
    p_workspace_id, v_email, p_role, v_hash, clock_timestamp() + p_ttl, v_uid
  )
  RETURNING * INTO v_invite;

  RETURN jsonb_build_object(
    'invite_id', v_invite.id,
    'workspace_id', v_invite.workspace_id,
    'role', v_invite.role,
    'expires_at', v_invite.expires_at,
    'token', v_token
  );
END;
$$;

CREATE OR REPLACE FUNCTION app.accept_workspace_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_hash text;
  v_invite public.workspace_invites;
  v_user_email text;
BEGIN
  v_uid := app.require_confirmed_email();
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT *
    INTO v_invite
  FROM public.workspace_invites i
  WHERE i.token_hash = v_hash
  FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'invite_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_revoked' USING ERRCODE = 'P0001';
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_already_accepted' USING ERRCODE = 'P0001';
  END IF;
  IF v_invite.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'invite_expired' USING ERRCODE = 'P0001';
  END IF;

  SELECT lower(btrim(u.email))
    INTO v_user_email
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_invite.email IS NOT NULL AND v_user_email IS DISTINCT FROM v_invite.email THEN
    RAISE EXCEPTION 'invite_email_mismatch' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.workspace_members m
    WHERE m.workspace_id = v_invite.workspace_id
      AND m.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'already_a_member' USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.role IN ('admin', 'professional') THEN
    PERFORM app.assert_professional_seat_available(v_invite.workspace_id);
  ELSE
    PERFORM app.lock_workspace_billing(v_invite.workspace_id);
  END IF;

  PERFORM set_config('app.bypass_protected_columns', 'on', true);

  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (v_invite.workspace_id, v_uid, v_invite.role, 'active');

  UPDATE public.workspace_invites
  SET accepted_at = clock_timestamp(),
      accepted_by = v_uid,
      updated_at = clock_timestamp()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'workspace_id', v_invite.workspace_id,
    'role', v_invite.role
  );
END;
$$;

-- Public wrappers are SECURITY DEFINER so authenticated does not need EXECUTE on app.* RPCs.
CREATE OR REPLACE FUNCTION public.create_workspace(p_name text, p_slug text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.create_workspace(p_name, p_slug);
$$;

CREATE OR REPLACE FUNCTION public.create_client_profile()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.create_client_profile();
$$;

CREATE OR REPLACE FUNCTION public.create_workspace_invite(
  p_workspace_id uuid,
  p_role public.member_role,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.create_workspace_invite(p_workspace_id, p_role, p_email);
$$;

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_token text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.accept_workspace_invite(p_token);
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_workspace(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_client_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_workspace_invite(uuid, public.member_role, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_workspace_invite(text) FROM PUBLIC, anon;

GRANT USAGE ON SCHEMA app TO postgres, service_role, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO postgres, service_role;

-- RLS policies call these as the invoking role. No other app.* EXECUTE for authenticated.
GRANT EXECUTE ON FUNCTION app.is_workspace_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app.has_workspace_role(uuid, public.member_role[]) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_workspace(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_client_profile() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_workspace_invite(uuid, public.member_role, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(text) TO authenticated, service_role;
