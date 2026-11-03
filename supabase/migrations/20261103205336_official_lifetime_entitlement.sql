-- Lifetime access for the official master owner's salons. Stripe may keep
-- writing the subscription row as expired; entitlement reads this table too.
-- Complimentary remains optional so the same file applies on production.

CREATE TABLE app.lifetime_entitlements (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces (id) ON DELETE CASCADE,
  granted_to uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  note text,
  CONSTRAINT lifetime_entitlements_note CHECK (note IS NULL OR char_length(note) <= 200)
);

COMMENT ON TABLE app.lifetime_entitlements IS
  'Non-expiring complimentary access. Read by app.workspace_has_entitlement. Does not replace or edit the subscription row.';

ALTER TABLE app.lifetime_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.lifetime_entitlements FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE app.lifetime_entitlements FROM PUBLIC, anon, authenticated, service_role;

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

CREATE OR REPLACE FUNCTION public.workspace_has_lifetime_entitlement(p_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF p_workspace_id IS NULL OR v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF NOT (
    app.is_platform_admin(v_uid)
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members m
      WHERE m.workspace_id = p_workspace_id
        AND m.user_id = v_uid
        AND m.status = 'active'::public.member_status
    )
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM app.lifetime_entitlements l
    WHERE l.workspace_id = p_workspace_id
      AND l.revoked_at IS NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.workspace_has_lifetime_entitlement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_has_lifetime_entitlement(uuid) TO authenticated;

INSERT INTO app.platform_admins (user_id, granted_by, revoked_at)
SELECT u.id, u.id, NULL
FROM auth.users u
WHERE lower(u.email) = app.official_platform_admin_email()
  AND u.email_confirmed_at IS NOT NULL
ORDER BY u.created_at ASC
LIMIT 1
ON CONFLICT (user_id) DO UPDATE
  SET revoked_at = NULL;

INSERT INTO app.lifetime_entitlements (workspace_id, granted_to, note)
SELECT DISTINCT ON (m.workspace_id)
  m.workspace_id,
  u.id,
  'Assinatura vitalícia da conta master oficial'
FROM auth.users u
JOIN public.workspace_members m
  ON m.user_id = u.id
 AND m.status = 'active'::public.member_status
 AND m.role = 'owner'::public.member_role
WHERE lower(u.email) = app.official_platform_admin_email()
  AND u.email_confirmed_at IS NOT NULL
ORDER BY m.workspace_id, m.created_at ASC
ON CONFLICT (workspace_id) DO UPDATE
  SET revoked_at = NULL,
      granted_to = EXCLUDED.granted_to,
      note = EXCLUDED.note;
