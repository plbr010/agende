-- New signatures replace old ones to avoid PostgREST overload ambiguity.
DROP FUNCTION public.create_workspace(text, text);
DROP FUNCTION app.create_workspace(text, text);

CREATE OR REPLACE FUNCTION app.create_workspace(p_name text, p_slug text DEFAULT NULL, p_plan text DEFAULT 'solo')
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
  v_now timestamptz;
  v_trial_end timestamptz;
BEGIN
  v_uid := app.require_confirmed_email();
  IF p_plan IS NULL OR p_plan NOT IN ('solo', 'equipe', 'salao') THEN
    RAISE EXCEPTION 'invalid_plan' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  v_now := clock_timestamp();
  v_name := btrim(p_name);

  IF v_name IS NULL OR char_length(v_name) < 2 OR char_length(v_name) > 80 THEN
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
      v_workspace.id, p_plan::public.subscription_plan, 'expired', NULL, NULL, NULL, NULL
    )
    RETURNING * INTO v_subscription;
  ELSE
    v_trial_end := v_now + interval '168 hours';
    INSERT INTO public.subscriptions (
      workspace_id, plan, status, trial_started_at, trial_ends_at,
      current_period_start, current_period_end
    ) VALUES (
      v_workspace.id, p_plan::public.subscription_plan, 'trialing', v_now, v_trial_end, v_now, v_trial_end
    )
    RETURNING * INTO v_subscription;

    INSERT INTO public.professional_trial_claims (user_id, workspace_id, claimed_at)
    VALUES (v_uid, v_workspace.id, v_now);

    v_trial_started := true;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (v_workspace.id, v_uid, 'owner', 'active');

  PERFORM set_config('app.bypass_protected_columns', 'off', true);

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

CREATE FUNCTION public.create_workspace(p_name text, p_slug text DEFAULT NULL, p_plan text DEFAULT 'solo')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT app.create_workspace(p_name, p_slug, p_plan);
$$;

CREATE FUNCTION app.change_trial_plan(p_workspace_id uuid, p_plan text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_subscription public.subscriptions;
  v_limit integer;
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);
  IF p_plan IS NULL OR p_plan NOT IN ('solo', 'equipe', 'salao') THEN
    RAISE EXCEPTION 'invalid_plan' USING ERRCODE = '22023';
  END IF;
  PERFORM app.lock_workspace_billing(p_workspace_id);
  SELECT * INTO v_subscription FROM public.subscriptions WHERE workspace_id = p_workspace_id;
  IF v_subscription.status <> 'trialing' OR v_subscription.trial_ends_at IS NULL
     OR v_subscription.trial_ends_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'trial_not_active' USING ERRCODE = 'P0001';
  END IF;
  SELECT max_professionals INTO v_limit FROM public.plans WHERE code = p_plan::public.subscription_plan;
  IF app.workspace_professional_seats(p_workspace_id) > v_limit THEN
    RAISE EXCEPTION 'plan_professional_limit_reached' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.subscriptions SET plan = p_plan::public.subscription_plan WHERE id = v_subscription.id;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);
  RETURN jsonb_build_object('plan', p_plan, 'trial_started_at', v_subscription.trial_started_at,
    'trial_ends_at', v_subscription.trial_ends_at);
END;
$$;
CREATE FUNCTION public.change_trial_plan(p_workspace_id uuid, p_plan text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT app.change_trial_plan(p_workspace_id, p_plan);
$$;
REVOKE ALL ON FUNCTION app.create_workspace(text,text,text), public.create_workspace(text,text,text),
  app.change_trial_plan(uuid,text), public.change_trial_plan(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app.create_workspace(text,text,text), public.create_workspace(text,text,text),
  app.change_trial_plan(uuid,text), public.change_trial_plan(uuid,text) TO authenticated, service_role;

UPDATE public.plans SET annual_price_cents = CASE code
  WHEN 'solo' THEN 79900 WHEN 'equipe' THEN 149900 WHEN 'salao' THEN 279900 END;