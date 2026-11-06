-- Repair production/staging schema drift: admin UI deployed without 12 read RPCs.
-- Restores ONLY the original, read-only functions from the platform master migration
-- (20261103180000_platform_master_admin.sql); no tables, data, subscriptions,
-- role assignments, billing settings, or existing RPCs are altered.
-- Every function requires app.require_platform_admin(), uses fixed search_path,
-- and grants EXECUTE to authenticated after revoking PUBLIC/anon access.

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

-- Fail safely if any expected public RPC is absent after the repair.
DO $admin_rpcs_check$
DECLARE
  v_rpc text;
BEGIN
  FOREACH v_rpc IN ARRAY ARRAY[
    'public.admin_list_professionals(text,text,text,integer,integer)',
    'public.admin_get_professional(uuid)',
    'public.admin_list_workspaces(text,text,text,integer,integer)',
    'public.admin_get_workspace(uuid)',
    'public.admin_list_clients(text,text,integer,integer)',
    'public.admin_get_client(uuid)',
    'public.admin_list_subscriptions(text,text,text,integer,integer)',
    'public.admin_list_billing_events(text,text,integer,integer)',
    'public.admin_list_appointments(text,text,uuid,timestamptz,timestamptz,integer,integer)',
    'public.admin_list_users(text,text,text,integer,integer)',
    'public.admin_support_overview()',
    'public.admin_list_audit_events(text,integer,integer)'
  ] LOOP
    IF to_regprocedure(v_rpc) IS NULL THEN
      RAISE EXCEPTION 'missing_platform_admin_rpc: %', v_rpc;
    END IF;
  END LOOP;
END;
$admin_rpcs_check$;
