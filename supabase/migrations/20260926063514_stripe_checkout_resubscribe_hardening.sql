
create or replace function app.bind_stripe_checkout(
  p_workspace_id uuid,
  p_payer_email text,
  p_external_customer_id text,
  p_external_subscription_id text,
  p_plan public.subscription_plan,
  p_billing_interval public.billing_interval,
  p_external_event_id text,
  p_event_type text,
  p_event_status text default null,
  p_occurred_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_payer_email, '')));
  v_customer_id text := btrim(coalesce(p_external_customer_id, ''));
  v_subscription_id text := btrim(coalesce(p_external_subscription_id, ''));
  v_max_professionals integer;
  v_used_professionals integer;
  v_subscription public.subscriptions%rowtype;
begin
  if p_workspace_id is null then
    raise exception 'workspace_required' using errcode = '22023';
  end if;

  if v_email = '' or char_length(v_email) > 320 then
    raise exception 'payer_email_invalid' using errcode = '22023';
  end if;

  if v_customer_id = '' or char_length(v_customer_id) > 200 then
    raise exception 'external_customer_invalid' using errcode = '22023';
  end if;

  if v_subscription_id = '' or char_length(v_subscription_id) > 200 then
    raise exception 'external_subscription_invalid' using errcode = '22023';
  end if;

  if p_plan is null or p_billing_interval is null then
    raise exception 'billing_state_required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.workspace_members m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace_id
      and m.status = 'active'::public.member_status
      and m.role in ('owner'::public.member_role, 'admin'::public.member_role)
      and u.email_confirmed_at is not null
      and lower(u.email) = v_email
  ) then
    raise exception 'billing_payer_not_workspace_manager' using errcode = '42501';
  end if;

  select p.max_professionals
    into v_max_professionals
  from public.plans p
  where p.code = p_plan;

  if v_max_professionals is null then
    raise exception 'plan_not_found' using errcode = '22023';
  end if;

  v_used_professionals := app.workspace_professional_seats(p_workspace_id);
  if v_used_professionals > v_max_professionals then
    raise exception 'plan_seat_limit_exceeded' using errcode = '23514';
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
     and v_subscription.billing_provider <> 'stripe' then
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
      and s.billing_provider = 'stripe'
      and (
        s.external_customer_id = v_customer_id
        or s.external_subscription_id = v_subscription_id
      )
  ) then
    raise exception 'external_billing_identity_already_bound' using errcode = '23505';
  end if;

  perform set_config('app.bypass_protected_columns', 'on', true);

  update public.subscriptions
  set plan = p_plan,
      billing_interval = p_billing_interval,
      billing_provider = 'stripe',
      external_customer_id = v_customer_id,
      external_subscription_id = v_subscription_id
  where workspace_id = p_workspace_id;

  perform app.record_billing_event(
    p_workspace_id,
    'stripe',
    p_external_event_id,
    p_event_type,
    null,
    'BRL',
    p_billing_interval,
    p_event_status,
    coalesce(p_occurred_at, now())
  );
end;
$$;

create or replace function public.bind_stripe_checkout(
  p_workspace_id uuid,
  p_payer_email text,
  p_external_customer_id text,
  p_external_subscription_id text,
  p_plan public.subscription_plan,
  p_billing_interval public.billing_interval,
  p_external_event_id text,
  p_event_type text,
  p_event_status text default null,
  p_occurred_at timestamptz default now()
)
returns void
language sql
security definer
set search_path = ''
as $$
  select app.bind_stripe_checkout(
    p_workspace_id,
    p_payer_email,
    p_external_customer_id,
    p_external_subscription_id,
    p_plan,
    p_billing_interval,
    p_external_event_id,
    p_event_type,
    p_event_status,
    p_occurred_at
  );
$$;

revoke all on function app.bind_stripe_checkout(
  uuid,text,text,text,public.subscription_plan,public.billing_interval,text,text,text,timestamptz
) from public, anon, authenticated;
revoke all on function public.bind_stripe_checkout(
  uuid,text,text,text,public.subscription_plan,public.billing_interval,text,text,text,timestamptz
) from public, anon, authenticated;
grant execute on function public.bind_stripe_checkout(
  uuid,text,text,text,public.subscription_plan,public.billing_interval,text,text,text,timestamptz
) to service_role;
