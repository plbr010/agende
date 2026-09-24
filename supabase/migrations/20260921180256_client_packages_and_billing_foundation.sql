
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  amount_cents integer,
  currency text not null default 'BRL',
  billing_interval public.billing_interval,
  event_status text,
  occurred_at timestamptz not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint billing_events_provider_len
    check (char_length(btrim(provider)) between 2 and 40),
  constraint billing_events_external_id_len
    check (char_length(external_event_id) between 1 and 200),
  constraint billing_events_event_type_len
    check (char_length(event_type) between 1 and 120),
  constraint billing_events_amount_check
    check (amount_cents is null or amount_cents>=0),
  constraint billing_events_currency_check
    check (currency ~ '^[A-Z]{3}$'),
  constraint billing_events_status_len
    check (event_status is null or char_length(event_status)<=80),
  constraint billing_events_provider_external_unique
    unique(provider,external_event_id)
);

create index billing_events_workspace_occurred_idx
  on public.billing_events(workspace_id,occurred_at desc);

alter table public.billing_events enable row level security;
alter table public.billing_events force row level security;

revoke all on public.billing_events from public,anon,authenticated;

grant select on public.billing_events to authenticated;

create policy billing_events_select_owner_admin
on public.billing_events
for select to authenticated
using (
  (select app.has_workspace_role(
    workspace_id,
    variadic array[
      'owner'::public.member_role,
      'admin'::public.member_role
    ]
  ))
);

alter table public.subscriptions
  add column billing_provider text,
  add column external_customer_id text,
  add column external_subscription_id text;

alter table public.subscriptions
  add constraint subscriptions_billing_provider_len
    check (billing_provider is null or char_length(billing_provider) between 2 and 40),
  add constraint subscriptions_external_customer_len
    check (external_customer_id is null or char_length(external_customer_id)<=200),
  add constraint subscriptions_external_subscription_len
    check (external_subscription_id is null or char_length(external_subscription_id)<=200);

create unique index subscriptions_provider_external_subscription_unique
  on public.subscriptions(billing_provider,external_subscription_id)
  where billing_provider is not null and external_subscription_id is not null;

create index subscriptions_provider_customer_idx
  on public.subscriptions(billing_provider,external_customer_id)
  where billing_provider is not null and external_customer_id is not null;

create or replace function app.record_billing_event(
  p_workspace_id uuid,
  p_provider text,
  p_external_event_id text,
  p_event_type text,
  p_amount_cents integer,
  p_currency text,
  p_billing_interval public.billing_interval,
  p_event_status text,
  p_occurred_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
begin
  if p_workspace_id is null then
    raise exception 'workspace_required' using errcode='22023';
  end if;

  if not exists(select 1 from public.workspaces where id=p_workspace_id) then
    raise exception 'workspace_not_found' using errcode='22023';
  end if;

  insert into public.billing_events(
    workspace_id,provider,external_event_id,event_type,amount_cents,
    currency,billing_interval,event_status,occurred_at,processed_at
  ) values(
    p_workspace_id,btrim(p_provider),btrim(p_external_event_id),btrim(p_event_type),
    p_amount_cents,upper(coalesce(nullif(btrim(p_currency),''),'BRL')),
    p_billing_interval,nullif(btrim(coalesce(p_event_status,'')),''),
    coalesce(p_occurred_at,now()),now()
  )
  on conflict(provider,external_event_id)
  do update set processed_at=excluded.processed_at
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.record_billing_event(
  p_workspace_id uuid,
  p_provider text,
  p_external_event_id text,
  p_event_type text,
  p_amount_cents integer default null,
  p_currency text default 'BRL',
  p_billing_interval public.billing_interval default null,
  p_event_status text default null,
  p_occurred_at timestamptz default now()
)
returns uuid
language sql
security definer
set search_path=''
as $$
  select app.record_billing_event(
    p_workspace_id,p_provider,p_external_event_id,p_event_type,
    p_amount_cents,p_currency,p_billing_interval,p_event_status,p_occurred_at
  );
$$;

revoke all on function app.record_billing_event(
  uuid,text,text,text,integer,text,public.billing_interval,text,timestamptz
) from public,anon,authenticated;

revoke all on function public.record_billing_event(
  uuid,text,text,text,integer,text,public.billing_interval,text,timestamptz
) from public,anon,authenticated;

grant execute on function public.record_billing_event(
  uuid,text,text,text,integer,text,public.billing_interval,text,timestamptz
) to service_role;

create or replace function app.list_my_packages()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_uid uuid;
begin
  v_uid:=app.require_confirmed_email();
  perform app.link_workspace_clients_by_confirmed_email();

  return coalesce((
    select jsonb_agg(row_data order by (row_data->>'purchased_at') desc)
    from (
      select jsonb_build_object(
        'id',cp.id,
        'workspace_id',cp.workspace_id,
        'workspace_name',w.name,
        'slug',w.slug,
        'name',cp.package_name_snapshot,
        'price_cents',cp.price_cents,
        'purchased_at',cp.purchased_at,
        'expires_at',cp.expires_at,
        'status',
          case
            when cp.status='active'::public.client_package_status
                 and cp.expires_at is not null
                 and cp.expires_at<=now()
              then 'expired'
            else cp.status::text
          end,
        'items',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'service_id',i.service_id,
              'service_name',s.name,
              'included_quantity',i.included_quantity,
              'used_quantity',i.used_quantity,
              'remaining_quantity',i.included_quantity-i.used_quantity
            )
            order by s.name
          )
          from public.client_package_items i
          left join public.services s
            on s.id=i.service_id
           and s.workspace_id=i.workspace_id
          where i.client_package_id=cp.id
            and i.workspace_id=cp.workspace_id
        ),'[]'::jsonb)
      ) as row_data
      from public.client_packages cp
      join public.workspace_clients c
        on c.id=cp.client_id
       and c.workspace_id=cp.workspace_id
      join public.workspaces w on w.id=cp.workspace_id
      where c.linked_user_id=v_uid
    ) x
  ),'[]'::jsonb);
end;
$$;

create or replace function public.list_my_packages()
returns jsonb
language sql
security definer
set search_path=''
as $$
  select app.list_my_packages();
$$;

revoke all on function app.list_my_packages() from public,anon,authenticated;
revoke all on function public.list_my_packages() from public,anon;
grant execute on function public.list_my_packages() to authenticated;
