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

  INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
  VALUES (v_workspace.id, v_uid, 'owner', 'active');

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

CREATE OR REPLACE FUNCTION app.create_client_profile()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := app.require_confirmed_email();

  INSERT INTO public.client_profiles (user_id)
  VALUES (v_uid)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN v_uid;
END;
$$;
