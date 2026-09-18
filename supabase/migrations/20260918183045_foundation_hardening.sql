-- Foundation hardening: BR phone, invite email bind, concurrency-safe seats, least-privilege GRANTs.
-- Does not rewrite previously applied migrations.

CREATE OR REPLACE FUNCTION app.is_valid_br_national(p_national text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    CASE
      WHEN p_national ~ '^[1-9][0-9]9[0-9]{8}$' THEN true
      WHEN p_national ~ '^[1-9][0-9][2-9][0-9]{7}$' THEN true
      ELSE false
    END;
$$;

CREATE OR REPLACE FUNCTION app.normalize_phone(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  digits text;
  national text;
BEGIN
  digits := regexp_replace(coalesce(input, ''), '\D', '', 'g');
  IF digits = '' THEN
    RETURN NULL;
  END IF;

  -- Country code 55 only when the remainder is a valid 10/11-digit national number.
  -- This keeps DDD 55 (e.g. (55) 99999-9999) instead of treating it as +55.
  IF left(digits, 2) = '55' AND length(digits) >= 12 THEN
    national := substr(digits, 3);
    IF app.is_valid_br_national(national) THEN
      RETURN '+55' || national;
    END IF;
  END IF;

  IF app.is_valid_br_national(digits) THEN
    RETURN '+55' || digits;
  END IF;

  RETURN NULL;
END;
$$;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_e164;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_br_e164;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_br_e164
  CHECK (
    phone IS NULL
    OR (
      phone ~ '^\+55[0-9]+$'
      AND app.is_valid_br_national(substr(phone, 4))
    )
  );

-- Trigger runs as the table owner so authenticated does not need EXECUTE on normalize_phone.
CREATE OR REPLACE FUNCTION app.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('app.bypass_protected_columns', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'profile_user_id_immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'profile_email_immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.intended_use IS DISTINCT FROM OLD.intended_use THEN
    RAISE EXCEPTION 'profile_intended_use_immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.terms_accepted_at IS DISTINCT FROM OLD.terms_accepted_at THEN
    RAISE EXCEPTION 'profile_terms_immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.privacy_accepted_at IS DISTINCT FROM OLD.privacy_accepted_at THEN
    RAISE EXCEPTION 'profile_privacy_immutable' USING ERRCODE = '42501';
  END IF;

  NEW.phone := app.normalize_phone(NEW.phone);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.lock_workspace_billing(p_workspace_id uuid)
RETURNS public.subscription_plan
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.subscription_plan;
BEGIN
  SELECT s.plan
    INTO v_plan
  FROM public.subscriptions s
  WHERE s.workspace_id = p_workspace_id
  FOR UPDATE;

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'subscription_missing' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_plan;
END;
$$;

CREATE OR REPLACE FUNCTION app.assert_professional_seat_available(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.plans;
  v_seats integer;
BEGIN
  PERFORM app.lock_workspace_billing(p_workspace_id);

  SELECT p.*
    INTO v_plan
  FROM public.subscriptions s
  JOIN public.plans p ON p.code = s.plan
  WHERE s.workspace_id = p_workspace_id;

  v_seats := app.workspace_professional_seats(p_workspace_id);
  IF v_seats >= v_plan.max_professionals THEN
    RAISE EXCEPTION 'plan_professional_limit_reached' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.enforce_professional_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.plans;
  v_seats integer;
  v_workspace_id uuid;
BEGIN
  v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW.status = 'active' AND NEW.role IN ('owner', 'admin', 'professional') THEN
    PERFORM app.lock_workspace_billing(v_workspace_id);

    SELECT p.*
      INTO v_plan
    FROM public.subscriptions s
    JOIN public.plans p ON p.code = s.plan
    WHERE s.workspace_id = v_workspace_id;

    SELECT count(*)::integer
      INTO v_seats
    FROM public.workspace_members m
    WHERE m.workspace_id = v_workspace_id
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin', 'professional');

    IF v_seats > v_plan.max_professionals THEN
      RAISE EXCEPTION 'plan_professional_limit_reached' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_members_seat_limit ON public.workspace_members;
CREATE CONSTRAINT TRIGGER workspace_members_seat_limit
  AFTER INSERT OR UPDATE OF role, status ON public.workspace_members
  DEFERRABLE INITIALLY IMMEDIATE
  FOR EACH ROW
  EXECUTE FUNCTION app.enforce_professional_seat_limit();

CREATE OR REPLACE FUNCTION app.create_workspace(p_name text, p_slug text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_name text;
  v_slug text;
  v_workspace public.workspaces;
  v_subscription public.subscriptions;
  v_trial_started boolean := false;
  v_now timestamptz := clock_timestamp();
  v_trial_end timestamptz;
BEGIN
  v_uid := app.require_confirmed_email();
  v_name := btrim(p_name);

  IF char_length(v_name) < 2 OR char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'invalid_workspace_name' USING ERRCODE = '22023';
  END IF;

  v_slug := app.allocate_workspace_slug(v_name, p_slug);

  PERFORM set_config('app.bypass_protected_columns', 'on', true);

  INSERT INTO public.workspaces (owner_user_id, name, slug)
  VALUES (v_uid, v_name, v_slug)
  RETURNING * INTO v_workspace;

  IF EXISTS (
    SELECT 1 FROM public.professional_trial_claims c WHERE c.user_id = v_uid
  ) THEN
    INSERT INTO public.subscriptions (
      workspace_id, plan, status, trial_started_at, trial_ends_at,
      current_period_start, current_period_end
    ) VALUES (
      v_workspace.id, 'solo', 'expired', NULL, NULL, NULL, NULL
    )
    RETURNING * INTO v_subscription;
  ELSE
    v_trial_end := v_now + interval '7 days';
    INSERT INTO public.subscriptions (
      workspace_id, plan, status, trial_started_at, trial_ends_at,
      current_period_start, current_period_end
    ) VALUES (
      v_workspace.id, 'solo', 'trialing', v_now, v_trial_end, v_now, v_trial_end
    )
    RETURNING * INTO v_subscription;

    INSERT INTO public.professional_trial_claims (user_id, workspace_id, claimed_at)
    VALUES (v_uid, v_workspace.id, v_now);

    v_trial_started := true;
  END IF;

  -- Membership after subscription so the seat-limit trigger can lock billing.
  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (v_workspace.id, v_uid, 'owner', 'active');

  RETURN jsonb_build_object(
    'workspace_id', v_workspace.id,
    'name', v_workspace.name,
    'slug', v_workspace.slug,
    'owner_user_id', v_workspace.owner_user_id,
    'subscription_id', v_subscription.id,
    'plan', v_subscription.plan,
    'status', v_subscription.status,
    'trial_started', v_trial_started,
    'trial_started_at', v_subscription.trial_started_at,
    'trial_ends_at', v_subscription.trial_ends_at
  );
END;
$$;

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
