-- Restores two November definitions that the October migrations overwrote in
-- environments where the November files were applied first (production and
-- agende-staging, rollout of 2026-11-09). Exact bodies of:
--   20261103205336_official_lifetime_entitlement.sql  -> app.workspace_has_entitlement
--   20261103180000_platform_master_admin.sql          -> app.assert_booking_creation_allowed
-- Effects of the regression: the lifetime grant stopped counting as an active
-- plan (owner salon saw "workspace_subscription_inactive"), and a salon
-- suspended from the master panel could still create appointments.
-- CREATE OR REPLACE keeps the existing ACLs. In a fresh database (version
-- order) this re-applies the same definitions and is a no-op.

CREATE OR REPLACE FUNCTION app.workspace_has_entitlement(p_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ok boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.workspace_id = p_workspace_id
      AND (
        (
          s.status = 'trialing'::public.subscription_status
          AND s.trial_ends_at IS NOT NULL
          AND s.trial_ends_at > now()
        )
        OR (
          s.status = 'active'::public.subscription_status
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
        )
      )
  ) INTO v_ok;
  IF v_ok THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM app.lifetime_entitlements l
    WHERE l.workspace_id = p_workspace_id
      AND l.revoked_at IS NULL
  ) INTO v_ok;
  IF v_ok THEN
    RETURN true;
  END IF;

  IF to_regclass('app.complimentary_entitlements') IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE
    $q$
      SELECT EXISTS (
        SELECT 1
        FROM app.complimentary_entitlements c
        WHERE c.workspace_id = $1
          AND c.revoked_at IS NULL
          AND c.starts_at <= now()
          AND c.ends_at > now()
      )
    $q$
    INTO v_ok
    USING p_workspace_id;

  RETURN COALESCE(v_ok, false);
END;
$$;

COMMENT ON FUNCTION app.workspace_has_entitlement(uuid) IS
  'Trial, paid period, unexpired complimentary grant, or a lifetime grant. Lifetime and complimentary do not change the subscription row.';

CREATE OR REPLACE FUNCTION app.assert_booking_creation_allowed(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF app.subject_is_held('workspace', p_workspace_id) THEN
    RAISE EXCEPTION 'workspace_suspended' USING ERRCODE = '42501';
  END IF;

  IF NOT app.workspace_has_entitlement(p_workspace_id) THEN
    RAISE EXCEPTION 'workspace_subscription_inactive' USING ERRCODE = '42501';
  END IF;

  IF app.booking_creation_globally_paused()
     AND NOT app.workspace_booking_exception_active(p_workspace_id) THEN
    RAISE EXCEPTION 'booking_creation_paused' USING ERRCODE = '42501';
  END IF;
END;
$$;
