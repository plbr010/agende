
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references public.profiles(user_id) on delete set null,
  actor_kind text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now(),
  constraint audit_events_actor_kind_check
    check (actor_kind in ('user','public_or_system')),
  constraint audit_events_action_check
    check (action in ('INSERT','UPDATE','DELETE')),
  constraint audit_events_entity_type_len
    check (char_length(entity_type) between 1 and 80)
);

create index audit_events_workspace_created_idx
  on public.audit_events(workspace_id, created_at desc);

create index audit_events_actor_created_idx
  on public.audit_events(actor_user_id, created_at desc);

create index audit_events_entity_idx
  on public.audit_events(workspace_id, entity_type, entity_id, created_at desc);

alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

revoke all on public.audit_events from public, anon, authenticated;
grant select on public.audit_events to authenticated;

create policy audit_events_select_owner_admin
on public.audit_events
for select
to authenticated
using (
  (select app.has_workspace_role(
    workspace_id,
    variadic array[
      'owner'::public.member_role,
      'admin'::public.member_role
    ]
  ))
);

create or replace function app.audit_sanitize(p_row jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_row is null then null
    else p_row - array[
      'email',
      'phone',
      'full_name',
      'birth_date',
      'notes',
      'customer_note',
      'description',
      'address',
      'business_email',
      'business_phone',
      'postal_code',
      'instagram',
      'token_hash'
    ]::text[]
  end;
$$;

create or replace function app.capture_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_workspace_id uuid;
  v_entity_id text;
  v_actor uuid;
begin
  v_old := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_new := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;

  v_workspace_id := coalesce(
    nullif(v_new->>'workspace_id','')::uuid,
    nullif(v_old->>'workspace_id','')::uuid
  );

  if v_workspace_id is null then
    return case when tg_op='DELETE' then old else new end;
  end if;

  v_entity_id := coalesce(v_new->>'id', v_old->>'id');
  v_actor := auth.uid();

  insert into public.audit_events(
    workspace_id,
    actor_user_id,
    actor_kind,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  ) values (
    v_workspace_id,
    v_actor,
    case when v_actor is null then 'public_or_system' else 'user' end,
    tg_op,
    tg_table_name,
    v_entity_id,
    app.audit_sanitize(v_old),
    app.audit_sanitize(v_new)
  );

  return case when tg_op='DELETE' then old else new end;
end;
$$;

drop trigger if exists subscriptions_audit on public.subscriptions;
create trigger subscriptions_audit
after insert or update or delete on public.subscriptions
for each row execute function app.capture_audit_event();

drop trigger if exists workspace_members_audit on public.workspace_members;
create trigger workspace_members_audit
after insert or update or delete on public.workspace_members
for each row execute function app.capture_audit_event();

drop trigger if exists services_audit on public.services;
create trigger services_audit
after insert or update or delete on public.services
for each row execute function app.capture_audit_event();

drop trigger if exists inventory_products_audit on public.inventory_products;
create trigger inventory_products_audit
after insert or update or delete on public.inventory_products
for each row execute function app.capture_audit_event();

drop trigger if exists service_packages_audit on public.service_packages;
create trigger service_packages_audit
after insert or update or delete on public.service_packages
for each row execute function app.capture_audit_event();

drop trigger if exists client_packages_audit on public.client_packages;
create trigger client_packages_audit
after insert or update or delete on public.client_packages
for each row execute function app.capture_audit_event();

drop trigger if exists package_redemptions_audit on public.package_redemptions;
create trigger package_redemptions_audit
after insert or update or delete on public.package_redemptions
for each row execute function app.capture_audit_event();

drop trigger if exists financial_entries_audit on public.financial_entries;
create trigger financial_entries_audit
after insert or update or delete on public.financial_entries
for each row execute function app.capture_audit_event();

revoke all on function app.audit_sanitize(jsonb) from public, anon, authenticated;
revoke all on function app.capture_audit_event() from public, anon, authenticated;
