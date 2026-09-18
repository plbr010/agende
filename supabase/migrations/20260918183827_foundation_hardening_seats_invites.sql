-- Foundation hardening (part 2): concurrency-safe seats, invite email bind, least-privilege GRANTs.
-- Companion to 20260918183729_foundation_hardening. Does not rewrite previously applied migrations.

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
