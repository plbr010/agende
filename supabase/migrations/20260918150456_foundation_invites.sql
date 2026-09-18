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
  v_plan public.plans;
  v_seats integer;
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
    SELECT p.*
      INTO v_plan
    FROM public.subscriptions s
    JOIN public.plans p ON p.code = s.plan
    WHERE s.workspace_id = p_workspace_id;

    IF v_plan.code IS NULL THEN
      RAISE EXCEPTION 'subscription_missing' USING ERRCODE = 'P0001';
    END IF;

    v_seats := app.workspace_professional_seats(p_workspace_id);
    IF v_seats >= v_plan.max_professionals THEN
      RAISE EXCEPTION 'plan_professional_limit_reached' USING ERRCODE = 'P0001';
    END IF;
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
  v_plan public.plans;
  v_seats integer;
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

  IF EXISTS (
    SELECT 1
    FROM public.workspace_members m
    WHERE m.workspace_id = v_invite.workspace_id
      AND m.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'already_a_member' USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.role IN ('admin', 'professional') THEN
    SELECT p.*
      INTO v_plan
    FROM public.subscriptions s
    JOIN public.plans p ON p.code = s.plan
    WHERE s.workspace_id = v_invite.workspace_id;

    v_seats := app.workspace_professional_seats(v_invite.workspace_id);
    IF v_seats >= v_plan.max_professionals THEN
      RAISE EXCEPTION 'plan_professional_limit_reached' USING ERRCODE = 'P0001';
    END IF;
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
