-- Preserve existing RPC signatures; Stripe subscriptions cannot use local trial plan changes.
CREATE OR REPLACE FUNCTION app.change_trial_plan(p_workspace_id uuid, p_plan text)
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
  IF v_subscription.external_subscription_id IS NOT NULL THEN
    RAISE EXCEPTION 'subscription_already_exists' USING ERRCODE = 'P0001';
  END IF;
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

-- Short, server-only lease serializes Checkout creation across tabs/managers.
-- Expiry permits recovery after an Edge process dies without releasing it.
CREATE TABLE app.stripe_checkout_leases (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  token uuid NOT NULL,
  expires_at timestamptz NOT NULL
);
ALTER TABLE app.stripe_checkout_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.stripe_checkout_leases FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.acquire_stripe_checkout(p_workspace_id uuid, p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_acquired integer;
BEGIN
  INSERT INTO app.stripe_checkout_leases(workspace_id, token, expires_at)
  VALUES (p_workspace_id, p_token, clock_timestamp() + interval '2 minutes')
  ON CONFLICT (workspace_id) DO UPDATE
    SET token = excluded.token, expires_at = excluded.expires_at
    WHERE app.stripe_checkout_leases.expires_at < clock_timestamp();
  GET DIAGNOSTICS v_acquired = ROW_COUNT;
  RETURN v_acquired > 0;
END;
$$;

CREATE FUNCTION public.release_stripe_checkout(p_workspace_id uuid, p_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM app.stripe_checkout_leases WHERE workspace_id = p_workspace_id AND token = p_token;
$$;
REVOKE ALL ON FUNCTION public.acquire_stripe_checkout(uuid,uuid), public.release_stripe_checkout(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_stripe_checkout(uuid,uuid), public.release_stripe_checkout(uuid,uuid) TO service_role;
