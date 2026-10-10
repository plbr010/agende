-- Additive billing correction; explicit approval required before production rollout.
-- Keeps all membership rows, trial dates, bindings and existing RPC grants.
DO $preflight$
BEGIN
  PERFORM pg_catalog.set_config('search_path','pg_catalog,public',true);
  IF md5(replace(pg_get_functiondef('app.sync_billing_subscription(uuid,text,text,text,public.subscription_plan,public.billing_interval,public.subscription_status,timestamptz,timestamptz,timestamptz)'::regprocedure),chr(13),''))
     NOT IN ('ef99daf53b01ff7d7388c28ca2ec2aa6', '01ee8d8dce2e38b4713a35ffafa5f026') THEN
    RAISE EXCEPTION 'unexpected_definition: app.sync_billing_subscription';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION app.sync_billing_subscription(p_workspace_id uuid, p_provider text, p_external_customer_id text, p_external_subscription_id text, p_plan subscription_plan, p_billing_interval billing_interval, p_status subscription_status, p_current_period_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_current_period_end timestamp with time zone DEFAULT NULL::timestamp with time zone, p_canceled_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_subscription public.subscriptions%rowtype;
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_customer_id text := btrim(coalesce(p_external_customer_id, ''));
  v_subscription_id text := btrim(coalesce(p_external_subscription_id, ''));
  v_canceled_at timestamptz;
  v_max_professionals integer;
  v_used_professionals integer;
  v_effective_status public.subscription_status := p_status;
begin
  if p_workspace_id is null then
    raise exception 'workspace_required' using errcode = '22023';
  end if;

  if v_provider <> 'stripe' then
    raise exception 'billing_provider_invalid' using errcode = '22023';
  end if;

  if v_customer_id = '' or char_length(v_customer_id) > 200 then
    raise exception 'external_customer_invalid' using errcode = '22023';
  end if;

  if v_subscription_id = '' or char_length(v_subscription_id) > 200 then
    raise exception 'external_subscription_invalid' using errcode = '22023';
  end if;

  if p_plan is null or p_billing_interval is null or p_status is null then
    raise exception 'billing_state_required' using errcode = '22023';
  end if;

  if p_current_period_start is not null
     and p_current_period_end is not null
     and p_current_period_end <= p_current_period_start then
    raise exception 'billing_period_invalid' using errcode = '22023';
  end if;

  if p_status in (
       'active'::public.subscription_status,
       'past_due'::public.subscription_status
     )
     and (p_current_period_start is null or p_current_period_end is null) then
    raise exception 'billing_period_required' using errcode = '22023';
  end if;

  select p.max_professionals
    into v_max_professionals
  from public.plans p
  where p.code = p_plan;

  if v_max_professionals is null then
    raise exception 'plan_not_found' using errcode = '22023';
  end if;

  select *
    into v_subscription
  from public.subscriptions
  where workspace_id = p_workspace_id
  for update;

  if not found then
    raise exception 'subscription_missing' using errcode = 'P0001';
  end if;

  if v_subscription.billing_provider is not null
     and v_subscription.billing_provider <> v_provider then
    raise exception 'billing_provider_conflict' using errcode = 'P0001';
  end if;

  if v_subscription.external_customer_id is not null
     and v_subscription.external_customer_id <> v_customer_id then
    raise exception 'external_customer_conflict' using errcode = 'P0001';
  end if;

  if v_subscription.external_subscription_id is not null
     and v_subscription.external_subscription_id <> v_subscription_id
     and v_subscription.status not in (
       'canceled'::public.subscription_status,
       'expired'::public.subscription_status
     ) then
    raise exception 'external_subscription_conflict' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.subscriptions s
    where s.workspace_id <> p_workspace_id
      and s.billing_provider = v_provider
      and (
        s.external_customer_id = v_customer_id
        or s.external_subscription_id = v_subscription_id
      )
  ) then
    raise exception 'external_billing_identity_already_bound' using errcode = '23505';
  end if;

  -- Count seats only after the subscription lock also used by membership writes.
  -- Record terminal/delinquent states regardless of seats. An incompatible paid
  -- downgrade must fail closed rather than retain the previous active entitlement.
  v_used_professionals := app.workspace_professional_seats(p_workspace_id);
  if v_used_professionals > v_max_professionals
     and p_status in ('active'::public.subscription_status, 'trialing'::public.subscription_status) then
    v_effective_status := 'expired'::public.subscription_status;
  end if;

  v_canceled_at :=
    case
      when p_status = 'canceled'::public.subscription_status
        then coalesce(p_canceled_at, now())
      else null
    end;

  perform set_config('app.bypass_protected_columns', 'on', true);

  update public.subscriptions
  set plan = p_plan,
      status = v_effective_status,
      billing_interval = p_billing_interval,
      billing_provider = v_provider,
      external_customer_id = v_customer_id,
      external_subscription_id = v_subscription_id,
      current_period_start = p_current_period_start,
      current_period_end = p_current_period_end,
      canceled_at = v_canceled_at
  where workspace_id = p_workspace_id;
end;
$function$

