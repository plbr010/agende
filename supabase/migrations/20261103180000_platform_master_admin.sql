-- Platform master-admin (SaaS operator). Tables stay in the private `app` schema.
-- Authenticated users cannot write authorization rows. Privilege lives here, not in
-- user-editable profile or JWT user_metadata. Do not apply to production from this change
-- without an explicit operator review; the application only reads these objects via RPCs.

CREATE TABLE app.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  granted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE app.platform_account_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  reason text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  lifted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  lifted_at timestamptz,
  CONSTRAINT platform_account_holds_type CHECK (subject_type IN ('user', 'workspace')),
  CONSTRAINT platform_account_holds_reason CHECK (char_length(btrim(reason)) BETWEEN 3 AND 200),
  CONSTRAINT platform_account_holds_lift CHECK (
    (lifted_at IS NULL AND lifted_by IS NULL)
    OR (lifted_at IS NOT NULL AND lifted_by IS NOT NULL)
  )
);

CREATE UNIQUE INDEX platform_account_holds_active_idx
  ON app.platform_account_holds (subject_type, subject_id)
  WHERE lifted_at IS NULL;

CREATE TABLE app.platform_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_audit_events_action CHECK (char_length(action) BETWEEN 1 AND 80),
  CONSTRAINT platform_audit_events_entity_type CHECK (char_length(entity_type) BETWEEN 1 AND 80)
);

CREATE INDEX platform_audit_events_created_idx
  ON app.platform_audit_events (created_at DESC);

CREATE INDEX platform_audit_events_entity_idx
  ON app.platform_audit_events (entity_type, entity_id, created_at DESC);

ALTER TABLE app.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.platform_admins FORCE ROW LEVEL SECURITY;
ALTER TABLE app.platform_account_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.platform_account_holds FORCE ROW LEVEL SECURITY;
ALTER TABLE app.platform_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.platform_audit_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE app.platform_admins FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE app.platform_account_holds FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE app.platform_audit_events FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app.is_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM app.platform_admins a
    WHERE a.user_id = p_user_id
      AND a.revoked_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION app.require_platform_admin()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := app.require_confirmed_email();
  IF NOT app.is_platform_admin(v_uid) THEN
    RAISE EXCEPTION 'not_platform_admin' USING ERRCODE = '42501';
  END IF;
  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION app.subject_is_held(p_subject_type text, p_subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_subject_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM app.platform_account_holds h
    WHERE h.subject_type = p_subject_type
      AND h.subject_id = p_subject_id
      AND h.lifted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION app.admin_limit(p_limit integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
$$;

CREATE OR REPLACE FUNCTION app.admin_offset(p_offset integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT GREATEST(COALESCE(p_offset, 0), 0);
$$;

CREATE OR REPLACE FUNCTION app.admin_query(p_query text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT nullif(app.discovery_text(p_query), '');
$$;

CREATE OR REPLACE FUNCTION app.admin_write_audit(
  p_actor uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO app.platform_audit_events (actor_user_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_actor,
    p_action,
    p_entity_type,
    p_entity_id,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION app.admin_monthly_cents(
  p_plan public.subscription_plan,
  p_interval public.billing_interval
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_interval = 'annual'::public.billing_interval THEN
      GREATEST(COALESCE(pl.annual_price_cents, pl.monthly_price_cents * 12), 0) / 12
    ELSE GREATEST(pl.monthly_price_cents, 0)
  END
  FROM public.plans pl
  WHERE pl.code = p_plan;
$$;

CREATE OR REPLACE FUNCTION app.billing_event_kind(p_event_type text, p_event_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN COALESCE(p_event_type, '') IN (
      'invoice.paid',
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded'
    ) OR COALESCE(p_event_status, '') IN ('paid', 'succeeded', 'complete') THEN 'paid'
    WHEN COALESCE(p_event_type, '') IN (
      'invoice.payment_failed',
      'checkout.session.async_payment_failed'
    ) OR COALESCE(p_event_status, '') IN ('failed', 'uncollectible') THEN 'failed'
    WHEN COALESCE(p_event_type, '') IN (
      'customer.subscription.deleted'
    ) OR COALESCE(p_event_status, '') IN ('canceled', 'cancelled') THEN 'canceled'
    ELSE 'pending'
  END;
$$;

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

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.is_platform_admin(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.my_platform_hold()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hold app.platform_account_holds;
  v_workspace uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('held', false);
  END IF;

  SELECT h.*
    INTO v_hold
  FROM app.platform_account_holds h
  WHERE h.subject_type = 'user'
    AND h.subject_id = v_uid
    AND h.lifted_at IS NULL
  ORDER BY h.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'held', true,
      'subject_type', 'user',
      'reason', v_hold.reason,
      'created_at', v_hold.created_at
    );
  END IF;

  SELECT m.workspace_id
    INTO v_workspace
  FROM public.workspace_members m
  WHERE m.user_id = v_uid
    AND m.status = 'active'::public.member_status
    AND app.subject_is_held('workspace', m.workspace_id)
  ORDER BY m.created_at
  LIMIT 1;

  IF v_workspace IS NOT NULL THEN
    SELECT h.*
      INTO v_hold
    FROM app.platform_account_holds h
    WHERE h.subject_type = 'workspace'
      AND h.subject_id = v_workspace
      AND h.lifted_at IS NULL
    ORDER BY h.created_at DESC
    LIMIT 1;

    RETURN jsonb_build_object(
      'held', true,
      'subject_type', 'workspace',
      'reason', v_hold.reason,
      'created_at', v_hold.created_at
    );
  END IF;

  RETURN jsonb_build_object('held', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_platform_admin(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
  v_privileged boolean := v_role = 'service_role';
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_admin_grant' USING ERRCODE = '22023';
  END IF;

  IF NOT v_privileged THEN
    v_actor := app.require_platform_admin();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id AND u.email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'admin_user_not_confirmed' USING ERRCODE = '22023';
  END IF;

  INSERT INTO app.platform_admins (user_id, granted_by, revoked_at)
  VALUES (p_user_id, v_actor, NULL)
  ON CONFLICT (user_id) DO UPDATE
    SET granted_by = EXCLUDED.granted_by,
        revoked_at = NULL,
        created_at = CASE
          WHEN platform_admins.revoked_at IS NULL THEN platform_admins.created_at
          ELSE now()
        END;

  PERFORM app.admin_write_audit(
    COALESCE(v_actor, p_user_id),
    'admin.grant',
    'user',
    p_user_id::text,
    jsonb_build_object('privileged', v_privileged)
  );

  RETURN jsonb_build_object('user_id', p_user_id, 'granted', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_account_hold(
  p_subject_type text,
  p_subject_id uuid,
  p_reason text,
  p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_reason text := nullif(btrim(COALESCE(p_reason, '')), '');
  v_type text := nullif(btrim(COALESCE(p_subject_type, '')), '');
  v_hold app.platform_account_holds;
BEGIN
  v_actor := app.require_platform_admin();

  IF v_type IS NULL OR v_type NOT IN ('user', 'workspace') OR p_subject_id IS NULL THEN
    RAISE EXCEPTION 'invalid_hold_target' USING ERRCODE = '22023';
  END IF;

  IF v_type = 'user' AND p_subject_id = v_actor THEN
    RAISE EXCEPTION 'cannot_hold_self' USING ERRCODE = '42501';
  END IF;

  IF v_type = 'user' AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = p_subject_id) THEN
    RAISE EXCEPTION 'hold_target_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_type = 'workspace' AND NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = p_subject_id) THEN
    RAISE EXCEPTION 'hold_target_not_found' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(p_active, true) THEN
    IF v_reason IS NULL OR char_length(v_reason) < 3 OR char_length(v_reason) > 200 THEN
      RAISE EXCEPTION 'invalid_hold_reason' USING ERRCODE = '22023';
    END IF;

    INSERT INTO app.platform_account_holds (subject_type, subject_id, reason, created_by)
    VALUES (v_type, p_subject_id, v_reason, v_actor)
    ON CONFLICT (subject_type, subject_id) WHERE lifted_at IS NULL
    DO UPDATE SET reason = EXCLUDED.reason
    RETURNING * INTO v_hold;

    PERFORM app.admin_write_audit(
      v_actor,
      'account.suspend',
      v_type,
      p_subject_id::text,
      jsonb_build_object('reason', v_reason, 'hold_id', v_hold.id)
    );
  ELSE
    UPDATE app.platform_account_holds
    SET lifted_at = now(),
        lifted_by = v_actor
    WHERE subject_type = v_type
      AND subject_id = p_subject_id
      AND lifted_at IS NULL
    RETURNING * INTO v_hold;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'hold_not_active' USING ERRCODE = '22023';
    END IF;

    PERFORM app.admin_write_audit(
      v_actor,
      'account.reactivate',
      v_type,
      p_subject_id::text,
      jsonb_build_object('hold_id', v_hold.id, 'note', v_reason)
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_hold.id,
    'subject_type', v_hold.subject_type,
    'subject_id', v_hold.subject_id,
    'reason', v_hold.reason,
    'created_at', v_hold.created_at,
    'lifted_at', v_hold.lifted_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_today date := (timezone('America/Sao_Paulo', v_now))::date;
  v_metrics jsonb;
  v_growth jsonb;
  v_subs jsonb;
  v_revenue jsonb;
BEGIN
  PERFORM app.require_platform_admin();

  SELECT jsonb_build_object(
    'professionals', (
      SELECT count(*)::int
      FROM public.profiles p
      WHERE p.intended_use = 'professional'::public.signup_intent
         OR EXISTS (
           SELECT 1 FROM public.workspace_members m
           WHERE m.user_id = p.user_id
             AND m.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
         )
    ),
    'workspaces', (SELECT count(*)::int FROM public.workspaces),
    'clients', (SELECT count(*)::int FROM public.client_profiles),
    'workspace_clients', (SELECT count(*)::int FROM public.workspace_clients WHERE archived_at IS NULL),
    'users', (SELECT count(*)::int FROM public.profiles),
    'active_users', (
      SELECT count(*)::int
      FROM auth.users u
      WHERE u.email_confirmed_at IS NOT NULL
        AND NOT app.subject_is_held('user', u.id)
    ),
    'signups_today', (
      SELECT count(*)::int FROM public.profiles p
      WHERE (timezone('America/Sao_Paulo', p.created_at))::date = v_today
    ),
    'signups_7d', (
      SELECT count(*)::int FROM public.profiles p
      WHERE p.created_at >= v_now - interval '7 days'
    ),
    'signups_30d', (
      SELECT count(*)::int FROM public.profiles p
      WHERE p.created_at >= v_now - interval '30 days'
    ),
    'subscriptions_active', (SELECT count(*)::int FROM public.subscriptions s WHERE s.status = 'active'),
    'subscriptions_trialing', (SELECT count(*)::int FROM public.subscriptions s WHERE s.status = 'trialing'),
    'subscriptions_canceled', (SELECT count(*)::int FROM public.subscriptions s WHERE s.status = 'canceled'),
    'subscriptions_past_due', (SELECT count(*)::int FROM public.subscriptions s WHERE s.status = 'past_due'),
    'subscriptions_expired', (SELECT count(*)::int FROM public.subscriptions s WHERE s.status = 'expired'),
    'mrr_cents', (
      SELECT COALESCE(sum(app.admin_monthly_cents(s.plan, s.billing_interval)), 0)::int
      FROM public.subscriptions s
      WHERE s.status = 'active'::public.subscription_status
    ),
    'revenue_cents', (
      SELECT COALESCE(sum(e.amount_cents), 0)::int
      FROM public.billing_events e
      WHERE e.amount_cents IS NOT NULL
        AND app.billing_event_kind(e.event_type, e.event_status) = 'paid'
    ),
    'trial_conversion_rate', (
      SELECT CASE
        WHEN count(*) FILTER (WHERE s.trial_started_at IS NOT NULL) = 0 THEN NULL
        ELSE round(
          count(*) FILTER (WHERE s.trial_started_at IS NOT NULL AND s.status = 'active'::public.subscription_status)::numeric
          / count(*) FILTER (WHERE s.trial_started_at IS NOT NULL)::numeric
        , 4)
      END
      FROM public.subscriptions s
    ),
    'churn_rate_30d', (
      SELECT CASE
        WHEN (
          count(*) FILTER (WHERE s.status = 'active'::public.subscription_status)
          + count(*) FILTER (
              WHERE s.status = 'canceled'::public.subscription_status
                AND COALESCE(s.canceled_at, s.updated_at) >= v_now - interval '30 days'
            )
        ) = 0 THEN NULL
        ELSE round(
          count(*) FILTER (
            WHERE s.status = 'canceled'::public.subscription_status
              AND COALESCE(s.canceled_at, s.updated_at) >= v_now - interval '30 days'
          )::numeric
          / (
            count(*) FILTER (WHERE s.status = 'active'::public.subscription_status)
            + count(*) FILTER (
                WHERE s.status = 'canceled'::public.subscription_status
                  AND COALESCE(s.canceled_at, s.updated_at) >= v_now - interval '30 days'
              )
          )::numeric
        , 4)
      END
      FROM public.subscriptions s
    ),
    'appointments', (SELECT count(*)::int FROM public.appointments),
    'plans', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'code', pl.code,
        'name', pl.name,
        'monthly_price_cents', pl.monthly_price_cents,
        'annual_price_cents', pl.annual_price_cents,
        'max_professionals', pl.max_professionals
      ) ORDER BY pl.monthly_price_cents), '[]'::jsonb)
      FROM public.plans pl
    )
  ) INTO v_metrics;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d.day, 'count', d.n) ORDER BY d.day), '[]'::jsonb)
    INTO v_growth
  FROM (
    SELECT gs::date AS day, count(p.user_id)::int AS n
    FROM generate_series(v_today - 29, v_today, interval '1 day') AS gs
    LEFT JOIN public.profiles p
      ON (timezone('America/Sao_Paulo', p.created_at))::date = gs::date
    GROUP BY gs::date
  ) d;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d.day, 'count', d.n) ORDER BY d.day), '[]'::jsonb)
    INTO v_subs
  FROM (
    SELECT gs::date AS day, count(s.id)::int AS n
    FROM generate_series(v_today - 29, v_today, interval '1 day') AS gs
    LEFT JOIN public.subscriptions s
      ON (timezone('America/Sao_Paulo', s.created_at))::date = gs::date
    GROUP BY gs::date
  ) d;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d.day, 'cents', d.cents) ORDER BY d.day), '[]'::jsonb)
    INTO v_revenue
  FROM (
    SELECT gs::date AS day, COALESCE(sum(e.amount_cents), 0)::int AS cents
    FROM generate_series(v_today - 29, v_today, interval '1 day') AS gs
    LEFT JOIN public.billing_events e
      ON (timezone('America/Sao_Paulo', e.occurred_at))::date = gs::date
     AND app.billing_event_kind(e.event_type, e.event_status) = 'paid'
    GROUP BY gs::date
  ) d;

  RETURN jsonb_build_object(
    'metrics', v_metrics,
    'growth', v_growth,
    'subscription_growth', v_subs,
    'revenue', v_revenue
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_professionals(
  p_query text DEFAULT NULL,
  p_plan text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_query text := app.admin_query(p_query);
  v_plan public.subscription_plan;
  v_status text := nullif(btrim(COALESCE(p_status, '')), '');
  v_limit integer := app.admin_limit(p_limit);
  v_offset integer := app.admin_offset(p_offset);
  v_total integer;
  v_items jsonb;
BEGIN
  PERFORM app.require_platform_admin();

  IF p_plan IS NOT NULL AND btrim(p_plan) <> '' THEN
    BEGIN
      v_plan := btrim(p_plan)::public.subscription_plan;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_admin_filter' USING ERRCODE = '22023';
    END;
  END IF;

  IF v_status IS NOT NULL AND v_status NOT IN (
    'trialing', 'active', 'past_due', 'expired', 'canceled', 'held', 'none'
  ) THEN
    RAISE EXCEPTION 'invalid_admin_filter' USING ERRCODE = '22023';
  END IF;

  WITH people AS (
    SELECT DISTINCT ON (p.user_id)
      p.user_id,
      p.full_name,
      p.email,
      p.phone,
      p.intended_use,
      p.created_at,
      w.id AS workspace_id,
      w.name AS workspace_name,
      w.slug AS workspace_slug,
      m.role,
      m.status AS member_status,
      s.plan,
      s.status AS subscription_status,
      app.subject_is_held('user', p.user_id) AS held,
      (SELECT count(*)::int FROM public.appointments a WHERE a.professional_member_id = m.id) AS appointment_count
    FROM public.profiles p
    LEFT JOIN public.workspace_members m
      ON m.user_id = p.user_id
     AND m.status <> 'removed'::public.member_status
    LEFT JOIN public.workspaces w ON w.id = m.workspace_id
    LEFT JOIN public.subscriptions s ON s.workspace_id = w.id
    WHERE (
      p.intended_use = 'professional'::public.signup_intent
      OR m.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
    )
      AND (
        v_query IS NULL
        OR strpos(app.discovery_text(p.full_name), v_query) > 0
        OR strpos(app.discovery_text(p.email), v_query) > 0
        OR strpos(app.discovery_text(COALESCE(p.phone, '')), v_query) > 0
        OR strpos(app.discovery_text(COALESCE(w.name, '')), v_query) > 0
        OR strpos(app.discovery_text(COALESCE(w.slug, '')), v_query) > 0
      )
      AND (v_plan IS NULL OR s.plan = v_plan)
      AND (
        v_status IS NULL
        OR (v_status = 'held' AND app.subject_is_held('user', p.user_id))
        OR (v_status = 'none' AND s.status IS NULL)
        OR (v_status NOT IN ('held', 'none') AND s.status::text = v_status)
      )
    ORDER BY p.user_id, m.created_at NULLS LAST
  )
  SELECT count(*)::int, COALESCE(
    jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC) FILTER (
      WHERE p.user_id IS NOT NULL
    ),
    '[]'::jsonb
  )
  INTO v_total, v_items
  FROM (
    SELECT * FROM people ORDER BY created_at DESC OFFSET v_offset LIMIT v_limit
  ) p;

  SELECT count(*)::int INTO v_total FROM (
    SELECT DISTINCT p.user_id
    FROM public.profiles p
    LEFT JOIN public.workspace_members m
      ON m.user_id = p.user_id
     AND m.status <> 'removed'::public.member_status
    LEFT JOIN public.workspaces w ON w.id = m.workspace_id
    LEFT JOIN public.subscriptions s ON s.workspace_id = w.id
    WHERE (
      p.intended_use = 'professional'::public.signup_intent
      OR m.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
    )
      AND (
        v_query IS NULL
        OR strpos(app.discovery_text(p.full_name), v_query) > 0
        OR strpos(app.discovery_text(p.email), v_query) > 0
        OR strpos(app.discovery_text(COALESCE(p.phone, '')), v_query) > 0
        OR strpos(app.discovery_text(COALESCE(w.name, '')), v_query) > 0
        OR strpos(app.discovery_text(COALESCE(w.slug, '')), v_query) > 0
      )
      AND (v_plan IS NULL OR s.plan = v_plan)
      AND (
        v_status IS NULL
        OR (v_status = 'held' AND app.subject_is_held('user', p.user_id))
        OR (v_status = 'none' AND s.status IS NULL)
        OR (v_status NOT IN ('held', 'none') AND s.status::text = v_status)
      )
  ) x;

  RETURN jsonb_build_object('items', COALESCE(v_items, '[]'::jsonb), 'total', v_total, 'limit', v_limit, 'offset', v_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_professional(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles;
  v_result jsonb;
BEGIN
  PERFORM app.require_platform_admin();
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_admin_target' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_profile FROM public.profiles p WHERE p.user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_build_object(
    'user_id', v_profile.user_id,
    'full_name', v_profile.full_name,
    'email', v_profile.email,
    'phone', v_profile.phone,
    'intended_use', v_profile.intended_use,
    'created_at', v_profile.created_at,
    'email_confirmed', EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = v_profile.user_id AND u.email_confirmed_at IS NOT NULL
    ),
    'held', app.subject_is_held('user', v_profile.user_id),
    'hold', (
      SELECT jsonb_build_object(
        'reason', h.reason,
        'created_at', h.created_at,
        'created_by', h.created_by
      )
      FROM app.platform_account_holds h
      WHERE h.subject_type = 'user' AND h.subject_id = v_profile.user_id AND h.lifted_at IS NULL
      ORDER BY h.created_at DESC
      LIMIT 1
    ),
    'memberships', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'member_id', m.id,
        'workspace_id', w.id,
        'workspace_name', w.name,
        'workspace_slug', w.slug,
        'role', m.role,
        'status', m.status,
        'created_at', m.created_at,
        'display_name', pp.display_name,
        'booking_enabled', pp.booking_enabled,
        'appointment_count', (SELECT count(*)::int FROM public.appointments a WHERE a.professional_member_id = m.id),
        'plan', s.plan,
        'subscription_status', s.status,
        'trial_started_at', s.trial_started_at,
        'trial_ends_at', s.trial_ends_at,
        'current_period_end', s.current_period_end,
        'billing_interval', s.billing_interval,
        'workspace_held', app.subject_is_held('workspace', w.id)
      ) ORDER BY m.created_at), '[]'::jsonb)
      FROM public.workspace_members m
      JOIN public.workspaces w ON w.id = m.workspace_id
      LEFT JOIN public.professional_profiles pp ON pp.member_id = m.id
      LEFT JOIN public.subscriptions s ON s.workspace_id = w.id
      WHERE m.user_id = v_profile.user_id
    ),
    'billing_events', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'workspace_id', e.workspace_id,
        'event_type', e.event_type,
        'event_status', e.event_status,
        'kind', app.billing_event_kind(e.event_type, e.event_status),
        'amount_cents', e.amount_cents,
        'currency', e.currency,
        'occurred_at', e.occurred_at
      ) ORDER BY e.occurred_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM public.billing_events e
        WHERE e.workspace_id IN (
          SELECT m.workspace_id FROM public.workspace_members m WHERE m.user_id = v_profile.user_id
        )
        ORDER BY e.occurred_at DESC
        LIMIT 50
      ) e
    ),
    'admin_history', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'action', a.action,
        'entity_type', a.entity_type,
        'entity_id', a.entity_id,
        'metadata', a.metadata,
        'created_at', a.created_at,
        'actor_user_id', a.actor_user_id
      ) ORDER BY a.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM app.platform_audit_events a
        WHERE a.entity_id = v_profile.user_id::text
           OR a.entity_id IN (
             SELECT m.workspace_id::text FROM public.workspace_members m WHERE m.user_id = v_profile.user_id
           )
        ORDER BY a.created_at DESC
        LIMIT 40
      ) a
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_workspaces(
  p_query text DEFAULT NULL,
  p_plan text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_query text := app.admin_query(p_query);
  v_plan public.subscription_plan;
  v_status text := nullif(btrim(COALESCE(p_status, '')), '');
  v_limit integer := app.admin_limit(p_limit);
  v_offset integer := app.admin_offset(p_offset);
  v_total integer;
  v_items jsonb;
BEGIN
  PERFORM app.require_platform_admin();

  IF p_plan IS NOT NULL AND btrim(p_plan) <> '' THEN
    BEGIN
      v_plan := btrim(p_plan)::public.subscription_plan;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_admin_filter' USING ERRCODE = '22023';
    END;
  END IF;

  IF v_status IS NOT NULL AND v_status NOT IN (
    'trialing', 'active', 'past_due', 'expired', 'canceled', 'held'
  ) THEN
    RAISE EXCEPTION 'invalid_admin_filter' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::int INTO v_total
  FROM public.workspaces w
  JOIN public.profiles owner ON owner.user_id = w.owner_user_id
  LEFT JOIN public.subscriptions s ON s.workspace_id = w.id
  LEFT JOIN public.workspace_settings st ON st.workspace_id = w.id
  WHERE (
    v_query IS NULL
    OR strpos(app.discovery_text(w.name), v_query) > 0
    OR strpos(app.discovery_text(w.slug), v_query) > 0
    OR strpos(app.discovery_text(owner.full_name), v_query) > 0
    OR strpos(app.discovery_text(owner.email), v_query) > 0
    OR strpos(app.discovery_text(COALESCE(st.city, '')), v_query) > 0
  )
    AND (v_plan IS NULL OR s.plan = v_plan)
    AND (
      v_status IS NULL
      OR (v_status = 'held' AND app.subject_is_held('workspace', w.id))
      OR (v_status <> 'held' AND s.status::text = v_status)
    );

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at DESC), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT
      w.id,
      w.name,
      w.slug,
      w.created_at,
      w.owner_user_id,
      owner.full_name AS owner_name,
      owner.email AS owner_email,
      st.city,
      st.state,
      s.plan,
      s.status AS subscription_status,
      s.billing_interval,
      s.trial_ends_at,
      s.current_period_end,
      app.subject_is_held('workspace', w.id) AS held,
      (SELECT count(*)::int FROM public.workspace_members m WHERE m.workspace_id = w.id AND m.status = 'active') AS member_count,
      (SELECT count(*)::int FROM public.appointments a WHERE a.workspace_id = w.id) AS appointment_count
    FROM public.workspaces w
    JOIN public.profiles owner ON owner.user_id = w.owner_user_id
    LEFT JOIN public.subscriptions s ON s.workspace_id = w.id
    LEFT JOIN public.workspace_settings st ON st.workspace_id = w.id
    WHERE (
      v_query IS NULL
      OR strpos(app.discovery_text(w.name), v_query) > 0
      OR strpos(app.discovery_text(w.slug), v_query) > 0
      OR strpos(app.discovery_text(owner.full_name), v_query) > 0
      OR strpos(app.discovery_text(owner.email), v_query) > 0
      OR strpos(app.discovery_text(COALESCE(st.city, '')), v_query) > 0
    )
      AND (v_plan IS NULL OR s.plan = v_plan)
      AND (
        v_status IS NULL
        OR (v_status = 'held' AND app.subject_is_held('workspace', w.id))
        OR (v_status <> 'held' AND s.status::text = v_status)
      )
    ORDER BY w.created_at DESC
    OFFSET v_offset
    LIMIT v_limit
  ) x;

  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'limit', v_limit, 'offset', v_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_workspace(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws public.workspaces;
BEGIN
  PERFORM app.require_platform_admin();
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'invalid_admin_target' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ws FROM public.workspaces w WHERE w.id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_not_found' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'id', v_ws.id,
    'name', v_ws.name,
    'slug', v_ws.slug,
    'created_at', v_ws.created_at,
    'owner_user_id', v_ws.owner_user_id,
    'held', app.subject_is_held('workspace', v_ws.id),
    'hold', (
      SELECT jsonb_build_object('reason', h.reason, 'created_at', h.created_at)
      FROM app.platform_account_holds h
      WHERE h.subject_type = 'workspace' AND h.subject_id = v_ws.id AND h.lifted_at IS NULL
      LIMIT 1
    ),
    'settings', (
      SELECT jsonb_build_object(
        'city', st.city,
        'state', st.state,
        'timezone', st.timezone,
        'discovery_enabled', st.discovery_enabled,
        'business_email', st.business_email,
        'business_phone', st.business_phone
      )
      FROM public.workspace_settings st
      WHERE st.workspace_id = v_ws.id
    ),
    'subscription', (
      SELECT jsonb_build_object(
        'plan', s.plan,
        'status', s.status,
        'billing_interval', s.billing_interval,
        'monthly_cents', app.admin_monthly_cents(s.plan, s.billing_interval),
        'trial_started_at', s.trial_started_at,
        'trial_ends_at', s.trial_ends_at,
        'current_period_start', s.current_period_start,
        'current_period_end', s.current_period_end,
        'canceled_at', s.canceled_at,
        'billing_provider', s.billing_provider,
        'external_subscription_id', s.external_subscription_id
      )
      FROM public.subscriptions s
      WHERE s.workspace_id = v_ws.id
    ),
    'members', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'member_id', m.id,
        'user_id', m.user_id,
        'full_name', p.full_name,
        'email', p.email,
        'role', m.role,
        'status', m.status,
        'created_at', m.created_at
      ) ORDER BY m.created_at), '[]'::jsonb)
      FROM public.workspace_members m
      JOIN public.profiles p ON p.user_id = m.user_id
      WHERE m.workspace_id = v_ws.id
    ),
    'appointment_count', (SELECT count(*)::int FROM public.appointments a WHERE a.workspace_id = v_ws.id),
    'billing_events', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'event_type', e.event_type,
        'event_status', e.event_status,
        'kind', app.billing_event_kind(e.event_type, e.event_status),
        'amount_cents', e.amount_cents,
        'currency', e.currency,
        'billing_interval', e.billing_interval,
        'occurred_at', e.occurred_at
      ) ORDER BY e.occurred_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM public.billing_events e
        WHERE e.workspace_id = v_ws.id
        ORDER BY e.occurred_at DESC
        LIMIT 50
      ) e
    ),
    'admin_history', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'action', a.action,
        'actor_user_id', a.actor_user_id,
        'metadata', a.metadata,
        'created_at', a.created_at
      ) ORDER BY a.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM app.platform_audit_events a
        WHERE a.entity_id = v_ws.id::text
        ORDER BY a.created_at DESC
        LIMIT 40
      ) a
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_clients(
  p_query text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_query text := app.admin_query(p_query);
  v_status text := nullif(btrim(COALESCE(p_status, '')), '');
  v_limit integer := app.admin_limit(p_limit);
  v_offset integer := app.admin_offset(p_offset);
  v_total integer;
  v_items jsonb;
BEGIN
  PERFORM app.require_platform_admin();

  IF v_status IS NOT NULL AND v_status NOT IN ('active', 'unconfirmed', 'held') THEN
    RAISE EXCEPTION 'invalid_admin_filter' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::int INTO v_total
  FROM public.client_profiles c
  JOIN public.profiles p ON p.user_id = c.user_id
  JOIN auth.users u ON u.id = c.user_id
  WHERE (
    v_query IS NULL
    OR strpos(app.discovery_text(p.full_name), v_query) > 0
    OR strpos(app.discovery_text(p.email), v_query) > 0
    OR strpos(app.discovery_text(COALESCE(p.phone, '')), v_query) > 0
  )
    AND (
      v_status IS NULL
      OR (v_status = 'held' AND app.subject_is_held('user', c.user_id))
      OR (v_status = 'unconfirmed' AND u.email_confirmed_at IS NULL)
      OR (v_status = 'active' AND u.email_confirmed_at IS NOT NULL AND NOT app.subject_is_held('user', c.user_id))
    );

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at DESC), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT
      p.user_id,
      p.full_name,
      p.email,
      p.phone,
      c.created_at,
      (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
      app.subject_is_held('user', p.user_id) AS held,
      (SELECT count(*)::int FROM public.workspace_clients wc WHERE wc.linked_user_id = p.user_id) AS salon_links,
      (SELECT count(*)::int FROM public.client_workspace_favorites f WHERE f.user_id = p.user_id) AS favorite_count
    FROM public.client_profiles c
    JOIN public.profiles p ON p.user_id = c.user_id
    JOIN auth.users u ON u.id = c.user_id
    WHERE (
      v_query IS NULL
      OR strpos(app.discovery_text(p.full_name), v_query) > 0
      OR strpos(app.discovery_text(p.email), v_query) > 0
      OR strpos(app.discovery_text(COALESCE(p.phone, '')), v_query) > 0
    )
      AND (
        v_status IS NULL
        OR (v_status = 'held' AND app.subject_is_held('user', c.user_id))
        OR (v_status = 'unconfirmed' AND u.email_confirmed_at IS NULL)
        OR (v_status = 'active' AND u.email_confirmed_at IS NOT NULL AND NOT app.subject_is_held('user', c.user_id))
      )
    ORDER BY c.created_at DESC
    OFFSET v_offset
    LIMIT v_limit
  ) x;

  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'limit', v_limit, 'offset', v_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_client(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  PERFORM app.require_platform_admin();
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_admin_target' USING ERRCODE = '22023';
  END IF;

  SELECT p.* INTO v_profile
  FROM public.profiles p
  JOIN public.client_profiles c ON c.user_id = p.user_id
  WHERE p.user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_not_found' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_profile.user_id,
    'full_name', v_profile.full_name,
    'email', v_profile.email,
    'phone', v_profile.phone,
    'residence_city', v_profile.residence_city,
    'created_at', v_profile.created_at,
    'email_confirmed', EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = v_profile.user_id AND u.email_confirmed_at IS NOT NULL
    ),
    'held', app.subject_is_held('user', v_profile.user_id),
    'favorites', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'workspace_id', w.id,
        'name', w.name,
        'slug', w.slug,
        'created_at', f.created_at
      ) ORDER BY f.created_at DESC), '[]'::jsonb)
      FROM public.client_workspace_favorites f
      JOIN public.workspaces w ON w.id = f.workspace_id
      WHERE f.user_id = v_profile.user_id
    ),
    'appointments', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'workspace_id', a.workspace_id,
        'workspace_name', w.name,
        'status', a.status,
        'starts_at', a.starts_at,
        'price_cents', a.price_cents,
        'service_name', svc.name
      ) ORDER BY a.starts_at DESC), '[]'::jsonb)
      FROM public.appointments a
      JOIN public.workspace_clients wc ON wc.id = a.client_id
      JOIN public.workspaces w ON w.id = a.workspace_id
      JOIN public.services svc ON svc.id = a.service_id
      WHERE wc.linked_user_id = v_profile.user_id
      LIMIT 40
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_subscriptions(
  p_query text DEFAULT NULL,
  p_plan text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_query text := app.admin_query(p_query);
  v_plan public.subscription_plan;
  v_status public.subscription_status;
  v_limit integer := app.admin_limit(p_limit);
  v_offset integer := app.admin_offset(p_offset);
  v_total integer;
  v_items jsonb;
BEGIN
  PERFORM app.require_platform_admin();

  IF p_plan IS NOT NULL AND btrim(p_plan) <> '' THEN
    BEGIN
      v_plan := btrim(p_plan)::public.subscription_plan;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_admin_filter' USING ERRCODE = '22023';
    END;
  END IF;

  IF p_status IS NOT NULL AND btrim(p_status) <> '' THEN
    BEGIN
      v_status := btrim(p_status)::public.subscription_status;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_admin_filter' USING ERRCODE = '22023';
    END;
  END IF;

  SELECT count(*)::int INTO v_total
  FROM public.subscriptions s
  JOIN public.workspaces w ON w.id = s.workspace_id
  JOIN public.profiles owner ON owner.user_id = w.owner_user_id
  WHERE (v_plan IS NULL OR s.plan = v_plan)
    AND (v_status IS NULL OR s.status = v_status)
    AND (
      v_query IS NULL
      OR strpos(app.discovery_text(w.name), v_query) > 0
      OR strpos(app.discovery_text(owner.email), v_query) > 0
      OR strpos(app.discovery_text(owner.full_name), v_query) > 0
    );

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at DESC), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT
      s.id,
      s.workspace_id,
      w.name AS workspace_name,
      w.slug,
      owner.full_name AS owner_name,
      owner.email AS owner_email,
      s.plan,
      s.status,
      s.billing_interval,
      app.admin_monthly_cents(s.plan, s.billing_interval) AS monthly_cents,
      s.trial_started_at,
      s.trial_ends_at,
      s.current_period_start,
      s.current_period_end,
      s.canceled_at,
      s.billing_provider,
      s.created_at,
      (
        SELECT count(*)::int FROM public.billing_events e
        WHERE e.workspace_id = s.workspace_id
          AND app.billing_event_kind(e.event_type, e.event_status) = 'paid'
      ) AS paid_events,
      (
        SELECT count(*)::int FROM public.billing_events e
        WHERE e.workspace_id = s.workspace_id
          AND app.billing_event_kind(e.event_type, e.event_status) = 'failed'
      ) AS failed_events,
      (
        SELECT count(*)::int FROM public.billing_events e
        WHERE e.workspace_id = s.workspace_id
          AND app.billing_event_kind(e.event_type, e.event_status) = 'pending'
      ) AS pending_events
    FROM public.subscriptions s
    JOIN public.workspaces w ON w.id = s.workspace_id
    JOIN public.profiles owner ON owner.user_id = w.owner_user_id
    WHERE (v_plan IS NULL OR s.plan = v_plan)
      AND (v_status IS NULL OR s.status = v_status)
      AND (
        v_query IS NULL
        OR strpos(app.discovery_text(w.name), v_query) > 0
        OR strpos(app.discovery_text(owner.email), v_query) > 0
        OR strpos(app.discovery_text(owner.full_name), v_query) > 0
      )
    ORDER BY s.created_at DESC
    OFFSET v_offset
    LIMIT v_limit
  ) x;

  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'limit', v_limit, 'offset', v_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_billing_events(
  p_query text DEFAULT NULL,
  p_kind text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_query text := app.admin_query(p_query);
  v_kind text := nullif(btrim(COALESCE(p_kind, '')), '');
  v_limit integer := app.admin_limit(p_limit);
  v_offset integer := app.admin_offset(p_offset);
  v_total integer;
  v_items jsonb;
BEGIN
  PERFORM app.require_platform_admin();

  IF v_kind IS NOT NULL AND v_kind NOT IN ('paid', 'pending', 'failed', 'canceled') THEN
    RAISE EXCEPTION 'invalid_admin_filter' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::int INTO v_total
  FROM public.billing_events e
  JOIN public.workspaces w ON w.id = e.workspace_id
  WHERE (v_kind IS NULL OR app.billing_event_kind(e.event_type, e.event_status) = v_kind)
    AND (
      v_query IS NULL
      OR strpos(app.discovery_text(w.name), v_query) > 0
      OR strpos(app.discovery_text(e.event_type), v_query) > 0
    );

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.occurred_at DESC), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT
      e.id,
      e.workspace_id,
      w.name AS workspace_name,
      e.event_type,
      e.event_status,
      app.billing_event_kind(e.event_type, e.event_status) AS kind,
      e.amount_cents,
      e.currency,
      e.billing_interval,
      e.occurred_at,
      e.provider
    FROM public.billing_events e
    JOIN public.workspaces w ON w.id = e.workspace_id
    WHERE (v_kind IS NULL OR app.billing_event_kind(e.event_type, e.event_status) = v_kind)
      AND (
        v_query IS NULL
        OR strpos(app.discovery_text(w.name), v_query) > 0
        OR strpos(app.discovery_text(e.event_type), v_query) > 0
      )
    ORDER BY e.occurred_at DESC
    OFFSET v_offset
    LIMIT v_limit
  ) x;

  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'limit', v_limit, 'offset', v_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_appointments(
  p_query text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_workspace_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_query text := app.admin_query(p_query);
  v_status public.appointment_status;
  v_limit integer := app.admin_limit(p_limit);
  v_offset integer := app.admin_offset(p_offset);
  v_total integer;
  v_items jsonb;
  v_counts jsonb;
BEGIN
  PERFORM app.require_platform_admin();

  IF p_status IS NOT NULL AND btrim(p_status) <> '' THEN
    BEGIN
      v_status := btrim(p_status)::public.appointment_status;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_admin_filter' USING ERRCODE = '22023';
    END;
  END IF;

  SELECT jsonb_build_object(
    'total', count(*)::int,
    'completed', count(*) FILTER (WHERE a.status = 'completed')::int,
    'cancelled', count(*) FILTER (WHERE a.status = 'cancelled')::int,
    'pending', count(*) FILTER (WHERE a.status IN ('scheduled', 'confirmed'))::int,
    'in_progress', count(*) FILTER (WHERE a.status = 'in_progress')::int,
    'no_show', count(*) FILTER (WHERE a.status = 'no_show')::int
  ) INTO v_counts
  FROM public.appointments a
  WHERE (p_workspace_id IS NULL OR a.workspace_id = p_workspace_id)
    AND (p_from IS NULL OR a.starts_at >= p_from)
    AND (p_to IS NULL OR a.starts_at < p_to);

  SELECT count(*)::int INTO v_total
  FROM public.appointments a
  JOIN public.workspaces w ON w.id = a.workspace_id
  JOIN public.workspace_clients wc ON wc.id = a.client_id
  JOIN public.workspace_members m ON m.id = a.professional_member_id
  JOIN public.profiles pro ON pro.user_id = m.user_id
  WHERE (p_workspace_id IS NULL OR a.workspace_id = p_workspace_id)
    AND (p_from IS NULL OR a.starts_at >= p_from)
    AND (p_to IS NULL OR a.starts_at < p_to)
    AND (v_status IS NULL OR a.status = v_status)
    AND (
      v_query IS NULL
      OR strpos(app.discovery_text(wc.full_name), v_query) > 0
      OR strpos(app.discovery_text(pro.full_name), v_query) > 0
      OR strpos(app.discovery_text(w.name), v_query) > 0
      OR strpos(app.discovery_text(COALESCE(wc.email, '')), v_query) > 0
    );

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.starts_at DESC), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT
      a.id,
      a.workspace_id,
      w.name AS workspace_name,
      a.status,
      a.starts_at,
      a.ends_at,
      a.price_cents,
      wc.full_name AS client_name,
      pro.full_name AS professional_name,
      svc.name AS service_name
    FROM public.appointments a
    JOIN public.workspaces w ON w.id = a.workspace_id
    JOIN public.workspace_clients wc ON wc.id = a.client_id
    JOIN public.workspace_members m ON m.id = a.professional_member_id
    JOIN public.profiles pro ON pro.user_id = m.user_id
    JOIN public.services svc ON svc.id = a.service_id
    WHERE (p_workspace_id IS NULL OR a.workspace_id = p_workspace_id)
      AND (p_from IS NULL OR a.starts_at >= p_from)
      AND (p_to IS NULL OR a.starts_at < p_to)
      AND (v_status IS NULL OR a.status = v_status)
      AND (
        v_query IS NULL
        OR strpos(app.discovery_text(wc.full_name), v_query) > 0
        OR strpos(app.discovery_text(pro.full_name), v_query) > 0
        OR strpos(app.discovery_text(w.name), v_query) > 0
        OR strpos(app.discovery_text(COALESCE(wc.email, '')), v_query) > 0
      )
    ORDER BY a.starts_at DESC
    OFFSET v_offset
    LIMIT v_limit
  ) x;

  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'counts', v_counts, 'limit', v_limit, 'offset', v_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_query text DEFAULT NULL,
  p_intent text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_query text := app.admin_query(p_query);
  v_intent public.signup_intent;
  v_status text := nullif(btrim(COALESCE(p_status, '')), '');
  v_limit integer := app.admin_limit(p_limit);
  v_offset integer := app.admin_offset(p_offset);
  v_total integer;
  v_items jsonb;
BEGIN
  PERFORM app.require_platform_admin();

  IF p_intent IS NOT NULL AND btrim(p_intent) <> '' THEN
    BEGIN
      v_intent := btrim(p_intent)::public.signup_intent;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_admin_filter' USING ERRCODE = '22023';
    END;
  END IF;

  IF v_status IS NOT NULL AND v_status NOT IN ('active', 'unconfirmed', 'held', 'admin') THEN
    RAISE EXCEPTION 'invalid_admin_filter' USING ERRCODE = '22023';
  END IF;

  SELECT count(*)::int INTO v_total
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE (v_intent IS NULL OR p.intended_use = v_intent)
    AND (
      v_query IS NULL
      OR strpos(app.discovery_text(p.full_name), v_query) > 0
      OR strpos(app.discovery_text(p.email), v_query) > 0
      OR strpos(app.discovery_text(COALESCE(p.phone, '')), v_query) > 0
    )
    AND (
      v_status IS NULL
      OR (v_status = 'held' AND app.subject_is_held('user', p.user_id))
      OR (v_status = 'unconfirmed' AND u.email_confirmed_at IS NULL)
      OR (v_status = 'admin' AND app.is_platform_admin(p.user_id))
      OR (v_status = 'active' AND u.email_confirmed_at IS NOT NULL AND NOT app.subject_is_held('user', p.user_id))
    );

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at DESC), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT
      p.user_id,
      p.full_name,
      p.email,
      p.phone,
      p.intended_use,
      p.created_at,
      (u.email_confirmed_at IS NOT NULL) AS email_confirmed,
      app.subject_is_held('user', p.user_id) AS held,
      app.is_platform_admin(p.user_id) AS platform_admin,
      EXISTS (SELECT 1 FROM public.client_profiles c WHERE c.user_id = p.user_id) AS has_client_profile,
      EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.user_id = p.user_id) AS has_membership
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE (v_intent IS NULL OR p.intended_use = v_intent)
      AND (
        v_query IS NULL
        OR strpos(app.discovery_text(p.full_name), v_query) > 0
        OR strpos(app.discovery_text(p.email), v_query) > 0
        OR strpos(app.discovery_text(COALESCE(p.phone, '')), v_query) > 0
      )
      AND (
        v_status IS NULL
        OR (v_status = 'held' AND app.subject_is_held('user', p.user_id))
        OR (v_status = 'unconfirmed' AND u.email_confirmed_at IS NULL)
        OR (v_status = 'admin' AND app.is_platform_admin(p.user_id))
        OR (v_status = 'active' AND u.email_confirmed_at IS NOT NULL AND NOT app.subject_is_held('user', p.user_id))
      )
    ORDER BY p.created_at DESC
    OFFSET v_offset
    LIMIT v_limit
  ) x;

  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'limit', v_limit, 'offset', v_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_support_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app.require_platform_admin();

  RETURN jsonb_build_object(
    'unconfirmed_signups', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'user_id', u.id,
        'email', u.email,
        'created_at', u.created_at,
        'has_profile', p.user_id IS NOT NULL,
        'intended_use', p.intended_use
      ) ORDER BY u.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT u.id, u.email, u.created_at, u.email_confirmed_at
        FROM auth.users u
        WHERE u.email_confirmed_at IS NULL
        ORDER BY u.created_at DESC
        LIMIT 30
      ) u
      LEFT JOIN public.profiles p ON p.user_id = u.id
    ),
    'held_accounts', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', h.id,
        'subject_type', h.subject_type,
        'subject_id', h.subject_id,
        'reason', h.reason,
        'created_at', h.created_at,
        'created_by', h.created_by
      ) ORDER BY h.created_at DESC), '[]'::jsonb)
      FROM app.platform_account_holds h
      WHERE h.lifted_at IS NULL
    ),
    'past_due', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'workspace_id', w.id,
        'workspace_name', w.name,
        'plan', s.plan,
        'status', s.status,
        'current_period_end', s.current_period_end
      ) ORDER BY s.updated_at DESC), '[]'::jsonb)
      FROM public.subscriptions s
      JOIN public.workspaces w ON w.id = s.workspace_id
      WHERE s.status = 'past_due'::public.subscription_status
    ),
    'privacy_requests', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', r.id,
        'user_id', r.user_id,
        'request_type', r.request_type,
        'status', r.status,
        'created_at', r.created_at
      ) ORDER BY r.created_at DESC), '[]'::jsonb)
      FROM public.privacy_requests r
      WHERE r.status IN ('pending'::public.privacy_request_status, 'processing'::public.privacy_request_status)
    ),
    'failed_payments', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'workspace_id', e.workspace_id,
        'workspace_name', w.name,
        'event_type', e.event_type,
        'occurred_at', e.occurred_at
      ) ORDER BY e.occurred_at DESC), '[]'::jsonb)
      FROM (
        SELECT * FROM public.billing_events e
        WHERE app.billing_event_kind(e.event_type, e.event_status) = 'failed'
        ORDER BY e.occurred_at DESC
        LIMIT 20
      ) e
      JOIN public.workspaces w ON w.id = e.workspace_id
    ),
    'application_error_log', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_audit_events(
  p_query text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_query text := app.admin_query(p_query);
  v_limit integer := app.admin_limit(p_limit);
  v_offset integer := app.admin_offset(p_offset);
  v_total integer;
  v_items jsonb;
BEGIN
  PERFORM app.require_platform_admin();

  SELECT count(*)::int INTO v_total
  FROM app.platform_audit_events a
  LEFT JOIN public.profiles p ON p.user_id = a.actor_user_id
  WHERE (
    v_query IS NULL
    OR strpos(app.discovery_text(a.action), v_query) > 0
    OR strpos(app.discovery_text(COALESCE(a.entity_type, '')), v_query) > 0
    OR strpos(app.discovery_text(COALESCE(p.full_name, '')), v_query) > 0
    OR strpos(app.discovery_text(COALESCE(p.email, '')), v_query) > 0
  );

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at DESC), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT
      a.id,
      a.actor_user_id,
      p.full_name AS actor_name,
      p.email AS actor_email,
      a.action,
      a.entity_type,
      a.entity_id,
      a.metadata,
      a.created_at
    FROM app.platform_audit_events a
    LEFT JOIN public.profiles p ON p.user_id = a.actor_user_id
    WHERE (
      v_query IS NULL
      OR strpos(app.discovery_text(a.action), v_query) > 0
      OR strpos(app.discovery_text(COALESCE(a.entity_type, '')), v_query) > 0
      OR strpos(app.discovery_text(COALESCE(p.full_name, '')), v_query) > 0
      OR strpos(app.discovery_text(COALESCE(p.email, '')), v_query) > 0
    )
    ORDER BY a.created_at DESC
    OFFSET v_offset
    LIMIT v_limit
  ) x;

  RETURN jsonb_build_object('items', v_items, 'total', v_total, 'limit', v_limit, 'offset', v_offset);
END;
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_platform_hold() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grant_platform_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_account_hold(text, uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_dashboard_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_professionals(text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_professional(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_workspaces(text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_workspace(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_clients(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_client(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_subscriptions(text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_billing_events(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_appointments(text, text, uuid, timestamptz, timestamptz, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_users(text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_support_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_audit_events(text, integer, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_platform_hold() TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_platform_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_account_hold(text, uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_professionals(text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_professional(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_workspaces(text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_clients(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions(text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_billing_events(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_appointments(text, text, uuid, timestamptz, timestamptz, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_support_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_events(text, integer, integer) TO authenticated;
