-- Additive read model only. Apply remotely only with explicit authorization.
-- No table, entitlement, RLS, existing RPC or billing mutation is changed.
CREATE FUNCTION app.admin_salon_rows()
RETURNS TABLE (id uuid, name text, owner_name text, owner_email text, plan text,
  status text, local_status text, provider_status text, trial_started_at timestamptz,
  trial_ends_at timestamptz, current_period_start timestamptz, current_period_end timestamptz,
  external_subscription_id text, billing_interval text, created_at timestamptz,
  lifetime boolean, evidence_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH source AS (
    SELECT w.id, w.name, p.full_name AS owner_name, p.email AS owner_email, s.plan::text,
      s.id AS subscription_id, s.status::text AS local_status,
      s.trial_started_at, s.trial_ends_at, s.current_period_start, s.current_period_end,
      s.external_subscription_id, s.billing_interval::text, w.created_at, s.billing_provider,
      public.workspace_has_lifetime_entitlement(w.id) AS lifetime,
      e.event_status AS provider_status, e.created_at AS evidence_at
    FROM public.workspaces w
    LEFT JOIN public.profiles p ON p.user_id = w.owner_user_id
    LEFT JOIN public.subscriptions s ON s.workspace_id = w.id
    LEFT JOIN LATERAL (
      SELECT be.event_status, be.created_at
      FROM public.billing_events be
      WHERE be.workspace_id=w.id AND be.provider='stripe'
        AND be.event_type LIKE 'customer.subscription.%'
        AND be.event_status IN ('trialing','active','past_due','unpaid','incomplete','canceled','paused','incomplete_expired')
        -- Do not use an observation preceding the most recent checkout binding.
        AND be.created_at >= COALESCE((
          SELECT max(binding.created_at) FROM public.billing_events binding
          WHERE binding.workspace_id=w.id AND binding.provider='stripe'
            AND binding.event_type IN ('checkout.session.completed','checkout.session.async_payment_succeeded')
        ), s.created_at)
      ORDER BY be.created_at DESC, be.id DESC LIMIT 1
    ) e ON s.billing_provider='stripe' AND s.external_subscription_id IS NOT NULL
  )
  SELECT x.id,x.name,x.owner_name,x.owner_email,x.plan,
    CASE
      WHEN x.subscription_id IS NULL THEN 'none'
      WHEN x.local_status='trialing' AND x.trial_ends_at > now() THEN 'trial'
      WHEN x.local_status='trialing' AND x.trial_ends_at <= now() THEN 'trial_expired'
      WHEN x.local_status='expired' AND x.external_subscription_id IS NULL
        AND x.trial_ends_at <= now() THEN 'trial_expired'
      WHEN x.local_status='canceled' THEN 'canceled'
      WHEN x.billing_provider='stripe' AND x.external_subscription_id IS NOT NULL
        AND x.local_status='past_due' AND x.provider_status='past_due' THEN 'past_due'
      WHEN x.billing_provider='stripe' AND x.external_subscription_id IS NOT NULL
        AND x.local_status='past_due' AND x.provider_status='unpaid' THEN 'unpaid'
      WHEN NOT x.lifetime AND x.local_status='active' AND x.provider_status='active'
        AND x.current_period_start <= now() AND x.current_period_end > now()
        AND EXISTS (SELECT 1 FROM public.billing_events paid
          WHERE paid.workspace_id=x.id AND paid.provider='stripe' AND paid.event_type='invoice.paid'
            AND paid.event_status='paid' AND paid.amount_cents > 0
            AND paid.occurred_at >= x.current_period_start AND paid.occurred_at <= now())
        THEN 'paid'
      ELSE 'unverified'
    END,
    x.local_status,x.provider_status,x.trial_started_at,x.trial_ends_at,
    x.current_period_start,x.current_period_end,x.external_subscription_id,x.billing_interval,
    x.created_at,x.lifetime,x.evidence_at
  FROM source x
  WHERE app.is_platform_admin(auth.uid());
$$;
REVOKE ALL ON FUNCTION app.admin_salon_rows() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.admin_salon_overview(p_query text DEFAULT NULL, p_status text DEFAULT NULL,
  p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_workspace_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result jsonb; v_query text := app.admin_query(p_query);
BEGIN
  PERFORM app.require_platform_admin();
  IF p_status IS NOT NULL AND p_status NOT IN ('trial','paid','delinquent','trial_expired','canceled','none','unverified')
    THEN RAISE EXCEPTION 'invalid_admin_filter' USING ERRCODE='22023'; END IF;
  WITH all_rows AS MATERIALIZED (SELECT * FROM app.admin_salon_rows()),
  filtered AS (
    SELECT * FROM all_rows r
    WHERE (p_workspace_id IS NULL OR r.id=p_workspace_id)
      AND (v_query IS NULL OR strpos(app.discovery_text(r.name),v_query)>0
        OR strpos(app.discovery_text(COALESCE(r.owner_name,'')),v_query)>0)
      AND (p_status IS NULL OR r.status=p_status OR (p_status='delinquent' AND r.status IN ('past_due','unpaid')))
  ), paged AS (
    SELECT * FROM filtered ORDER BY created_at DESC,id
    LIMIT app.admin_limit(p_limit) OFFSET app.admin_offset(p_offset)
  )
  SELECT jsonb_build_object(
    'items',COALESCE((SELECT jsonb_agg(to_jsonb(paged) ORDER BY created_at DESC,id) FROM paged),'[]'::jsonb),
    'total',(SELECT count(*) FROM filtered),
    'limit',app.admin_limit(p_limit),'offset',app.admin_offset(p_offset),
    'counts',(SELECT jsonb_build_object('total',count(*),'trial',count(*) FILTER (WHERE status='trial'),
      'paid',count(*) FILTER (WHERE status='paid'),'delinquent',count(*) FILTER (WHERE status IN ('past_due','unpaid')),
      'unverified',count(*) FILTER (WHERE status='unverified')) FROM all_rows),
    'as_of',now()
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_salon_overview(text,text,integer,integer,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.admin_salon_overview(text,text,integer,integer,uuid) TO authenticated;
COMMENT ON FUNCTION public.admin_salon_overview(text,text,integer,integer,uuid) IS
  'Read-only master view; current Auth identity/private grant required. Uses synchronized evidence, never Stripe network calls.';

-- Rollback, after reverting frontend: DROP FUNCTION public.admin_salon_overview(text,text,integer,integer,uuid);
-- DROP FUNCTION app.admin_salon_rows();
