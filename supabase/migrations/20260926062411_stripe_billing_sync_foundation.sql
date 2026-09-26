
create unique index if not exists subscriptions_provider_external_customer_unique
  on public.subscriptions(billing_provider, external_customer_id)
  where billing_provider is not null and external_customer_id is not null;

create or replace function app.bind_billing_customer(
  p_workspace_id uuid,
  p_provider text,
  p_external_customer_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_customer_id text := btrim(coalesce(p_external_customer_id, ''));
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

  if exists (
    select 1
    from public.subscriptions s
    where s.workspace_id <> p_workspace_id
      and s.billing_provider = v_provider
      and s.external_customer_id = v_customer_id
  ) then
    raise exception 'external_customer_already_bound' using errcode = '23505';
  end if;

  perform set_config('app.bypass_protected_columns', 'on', true);

  update public.subscriptions
  set billing_provider = v_provider,
      external_customer_id = v_customer_id
  where workspace_id = p_workspace_id;
end;
$$;

create or replace function public.bind_billing_customer(
  p_workspace_id uuid,
  p_provider text,
  p_external_customer_id text
)
returns void
language sql
security definer
set search_path = ''
as $$
  select app.bind_billing_customer(
    p_workspace_id,
    p_provider,
    p_external_customer_id
  );
$$;

create or replace function app.sync_billing_subscription(
  p_workspace_id uuid,
  p_provider text,
  p_external_customer_id text,
  p_external_subscription_id text,
  p_plan public.subscription_plan,
  p_billing_interval public.billing_interval,
  p_status public.subscription_status,
  p_current_period_start timestamptz default null,
  p_current_period_end timestamptz default null,
  p_canceled_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_customer_id text := btrim(coalesce(p_external_customer_id, ''));
  v_subscription_id text := btrim(coalesce(p_external_subscription_id, ''));
  v_canceled_at timestamptz;
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
     and v_subscription.external_subscription_id <> v_subscription_id then
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

  v_canceled_at :=
    case
      when p_status = 'canceled'::public.subscription_status
        then coalesce(p_canceled_at, now())
      else null
    end;

  perform set_config('app.bypass_protected_columns', 'on', true);

  update public.subscriptions
  set plan = p_plan,
      status = p_status,
      billing_interval = p_billing_interval,
      billing_provider = v_provider,
      external_customer_id = v_customer_id,
      external_subscription_id = v_subscription_id,
      current_period_start = p_current_period_start,
      current_period_end = p_current_period_end,
      canceled_at = v_canceled_at
  where workspace_id = p_workspace_id;
end;
$$;

create or replace function public.sync_billing_subscription(
  p_workspace_id uuid,
  p_provider text,
  p_external_customer_id text,
  p_external_subscription_id text,
  p_plan public.subscription_plan,
  p_billing_interval public.billing_interval,
  p_status public.subscription_status,
  p_current_period_start timestamptz default null,
  p_current_period_end timestamptz default null,
  p_canceled_at timestamptz default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  select app.sync_billing_subscription(
    p_workspace_id,
    p_provider,
    p_external_customer_id,
    p_external_subscription_id,
    p_plan,
    p_billing_interval,
    p_status,
    p_current_period_start,
    p_current_period_end,
    p_canceled_at
  );
$$;

revoke all on function app.bind_billing_customer(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.bind_billing_customer(uuid, text, text)
  from public, anon, authenticated;

revoke all on function app.sync_billing_subscription(
  uuid, text, text, text,
  public.subscription_plan,
  public.billing_interval,
  public.subscription_status,
  timestamptz, timestamptz, timestamptz
) from public, anon, authenticated;

revoke all on function public.sync_billing_subscription(
  uuid, text, text, text,
  public.subscription_plan,
  public.billing_interval,
  public.subscription_status,
  timestamptz, timestamptz, timestamptz
) from public, anon, authenticated;

grant execute on function public.bind_billing_customer(uuid, text, text)
  to service_role;

grant execute on function public.sync_billing_subscription(
  uuid, text, text, text,
  public.subscription_plan,
  public.billing_interval,
  public.subscription_status,
  timestamptz, timestamptz, timestamptz
) to service_role;

update public.plans
set annual_price_cents = case code
  when 'solo'::public.subscription_plan then 79900
  when 'equipe'::public.subscription_plan then 149900
  when 'salao'::public.subscription_plan then 279900
end
where code in (
  'solo'::public.subscription_plan,
  'equipe'::public.subscription_plan,
  'salao'::public.subscription_plan
);
