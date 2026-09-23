
create type public.client_package_status as enum ('active','exhausted','cancelled');

create table public.service_packages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null,
  validity_days integer,
  active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_packages_name_len check (char_length(btrim(name)) between 2 and 100),
  constraint service_packages_description_len check (description is null or char_length(description) <= 1000),
  constraint service_packages_price check (price_cents >= 0 and price_cents <= 100000000),
  constraint service_packages_validity check (validity_days is null or validity_days between 1 and 3650),
  constraint service_packages_archived_inactive check (archived_at is null or active = false),
  constraint service_packages_id_workspace_key unique (id, workspace_id)
);

create table public.service_package_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  package_id uuid not null,
  service_id uuid not null,
  quantity integer not null,
  created_at timestamptz not null default now(),
  constraint service_package_items_quantity check (quantity between 1 and 100),
  constraint service_package_items_package_fk foreign key (package_id, workspace_id)
    references public.service_packages(id, workspace_id) on delete cascade,
  constraint service_package_items_service_fk foreign key (service_id, workspace_id)
    references public.services(id, workspace_id) on delete restrict,
  constraint service_package_items_unique unique (package_id, service_id)
);

create table public.client_packages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null,
  package_id uuid not null,
  package_name_snapshot text not null,
  price_cents integer not null,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz,
  status public.client_package_status not null default 'active',
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_packages_price check (price_cents >= 0 and price_cents <= 100000000),
  constraint client_packages_client_fk foreign key (client_id, workspace_id)
    references public.workspace_clients(id, workspace_id) on delete restrict,
  constraint client_packages_package_fk foreign key (package_id, workspace_id)
    references public.service_packages(id, workspace_id) on delete restrict,
  constraint client_packages_id_workspace_key unique (id, workspace_id)
);

create table public.client_package_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_package_id uuid not null,
  service_id uuid not null,
  included_quantity integer not null,
  used_quantity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_package_items_included check (included_quantity between 1 and 100),
  constraint client_package_items_used check (used_quantity between 0 and included_quantity),
  constraint client_package_items_package_fk foreign key (client_package_id, workspace_id)
    references public.client_packages(id, workspace_id) on delete cascade,
  constraint client_package_items_service_fk foreign key (service_id, workspace_id)
    references public.services(id, workspace_id) on delete restrict,
  constraint client_package_items_unique unique (client_package_id, service_id),
  constraint client_package_items_id_workspace_key unique (id, workspace_id)
);

create table public.package_redemptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_package_id uuid not null,
  client_package_item_id uuid not null,
  appointment_id uuid not null,
  quantity integer not null default 1,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  constraint package_redemptions_quantity check (quantity = 1),
  constraint package_redemptions_package_fk foreign key (client_package_id, workspace_id)
    references public.client_packages(id, workspace_id) on delete restrict,
  constraint package_redemptions_item_fk foreign key (client_package_item_id, workspace_id)
    references public.client_package_items(id, workspace_id) on delete restrict,
  constraint package_redemptions_appointment_fk foreign key (appointment_id, workspace_id)
    references public.appointments(id, workspace_id) on delete restrict,
  constraint package_redemptions_appointment_unique unique (appointment_id)
);

create index service_packages_workspace_idx on public.service_packages(workspace_id);
create index service_package_items_workspace_idx on public.service_package_items(workspace_id);
create index service_package_items_service_workspace_idx on public.service_package_items(service_id, workspace_id);
create index client_packages_workspace_client_idx on public.client_packages(workspace_id, client_id, purchased_at desc);
create index client_packages_package_workspace_idx on public.client_packages(package_id, workspace_id);
create index client_packages_created_by_idx on public.client_packages(created_by);
create index client_package_items_workspace_idx on public.client_package_items(workspace_id);
create index client_package_items_service_workspace_idx on public.client_package_items(service_id, workspace_id);
create index package_redemptions_workspace_idx on public.package_redemptions(workspace_id);
create index package_redemptions_client_package_idx on public.package_redemptions(client_package_id, workspace_id);
create index package_redemptions_item_workspace_idx on public.package_redemptions(client_package_item_id, workspace_id);
create index package_redemptions_created_by_idx on public.package_redemptions(created_by);

create or replace function app.touch_package_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger service_packages_touch_updated_at
before update on public.service_packages
for each row execute function app.touch_package_updated_at();

create trigger client_packages_touch_updated_at
before update on public.client_packages
for each row execute function app.touch_package_updated_at();

create trigger client_package_items_touch_updated_at
before update on public.client_package_items
for each row execute function app.touch_package_updated_at();

create or replace function app.assert_package_manager(p_workspace_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_confirmed_email();
  if not app.has_workspace_role(
    p_workspace_id,
    variadic array['owner'::public.member_role,'admin'::public.member_role]
  ) then raise exception 'not_authorized' using errcode='42501'; end if;
end;
$$;

create or replace function app.assert_package_operator(p_workspace_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_confirmed_email();
  if not app.has_workspace_role(
    p_workspace_id,
    variadic array['owner'::public.member_role,'admin'::public.member_role,'receptionist'::public.member_role]
  ) then raise exception 'not_authorized' using errcode='42501'; end if;
end;
$$;

create or replace function app.replace_service_package_items(
  p_workspace_id uuid,p_package_id uuid,p_items jsonb
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item jsonb; v_service_id uuid; v_quantity integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'invalid_package_items' using errcode='22023';
  end if;
  delete from public.service_package_items where workspace_id=p_workspace_id and package_id=p_package_id;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_service_id := (v_item->>'service_id')::uuid;
      v_quantity := (v_item->>'quantity')::integer;
    exception when others then
      raise exception 'invalid_package_item' using errcode='22023';
    end;
    if v_quantity is null or v_quantity < 1 or v_quantity > 100 then
      raise exception 'invalid_package_quantity' using errcode='22023';
    end if;
    if not exists (
      select 1 from public.services s
      where s.id=v_service_id and s.workspace_id=p_workspace_id and s.archived_at is null and s.active
    ) then raise exception 'service_not_found' using errcode='22023'; end if;
    insert into public.service_package_items(workspace_id,package_id,service_id,quantity)
    values(p_workspace_id,p_package_id,v_service_id,v_quantity)
    on conflict (package_id,service_id) do update set quantity=excluded.quantity;
  end loop;
end;
$$;

create or replace function app.create_service_package(
  p_workspace_id uuid,p_name text,p_description text,p_price_cents integer,
  p_validity_days integer,p_items jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform app.assert_package_manager(p_workspace_id);
  if p_price_cents is null or p_price_cents < 0 or p_price_cents > 100000000 then
    raise exception 'invalid_package_price' using errcode='22023';
  end if;
  if p_validity_days is not null and (p_validity_days < 1 or p_validity_days > 3650) then
    raise exception 'invalid_validity_days' using errcode='22023';
  end if;
  insert into public.service_packages(workspace_id,name,description,price_cents,validity_days,created_by)
  values(p_workspace_id,btrim(p_name),nullif(btrim(coalesce(p_description,'')),''),p_price_cents,p_validity_days,auth.uid())
  returning id into v_id;
  perform app.replace_service_package_items(p_workspace_id,v_id,p_items);
  return v_id;
end;
$$;

create or replace function app.update_service_package(
  p_workspace_id uuid,p_package_id uuid,p_name text,p_description text,
  p_price_cents integer,p_validity_days integer,p_active boolean,p_items jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_package_manager(p_workspace_id);
  if p_price_cents is null or p_price_cents < 0 or p_price_cents > 100000000 then
    raise exception 'invalid_package_price' using errcode='22023';
  end if;
  update public.service_packages
  set name=btrim(p_name),description=nullif(btrim(coalesce(p_description,'')),''),
      price_cents=p_price_cents,validity_days=p_validity_days,
      active=case when archived_at is null then coalesce(p_active,true) else false end
  where id=p_package_id and workspace_id=p_workspace_id;
  if not found then raise exception 'package_not_found' using errcode='P0002'; end if;
  perform app.replace_service_package_items(p_workspace_id,p_package_id,p_items);
  return p_package_id;
end;
$$;

create or replace function app.archive_service_package(p_workspace_id uuid,p_package_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_package_manager(p_workspace_id);
  update public.service_packages set archived_at=coalesce(archived_at,clock_timestamp()),active=false
  where id=p_package_id and workspace_id=p_workspace_id;
  if not found then raise exception 'package_not_found' using errcode='P0002'; end if;
  return p_package_id;
end;
$$;

create or replace function app.reactivate_service_package(p_workspace_id uuid,p_package_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_package_manager(p_workspace_id);
  update public.service_packages set archived_at=null,active=true
  where id=p_package_id and workspace_id=p_workspace_id;
  if not found then raise exception 'package_not_found' using errcode='P0002'; end if;
  return p_package_id;
end;
$$;

create or replace function app.sell_service_package(p_workspace_id uuid,p_client_id uuid,p_package_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_package public.service_packages%rowtype; v_client_archived timestamptz; v_id uuid;
begin
  perform app.assert_package_operator(p_workspace_id);
  select * into v_package from public.service_packages
  where id=p_package_id and workspace_id=p_workspace_id for share;
  if v_package.id is null or v_package.archived_at is not null or not v_package.active then
    raise exception 'package_not_available' using errcode='22023';
  end if;
  select archived_at into v_client_archived from public.workspace_clients
  where id=p_client_id and workspace_id=p_workspace_id;
  if not found then raise exception 'client_not_found' using errcode='22023'; end if;
  if v_client_archived is not null then raise exception 'client_archived' using errcode='22023'; end if;
  if not exists(select 1 from public.service_package_items where package_id=p_package_id and workspace_id=p_workspace_id) then
    raise exception 'package_has_no_items' using errcode='22023';
  end if;
  insert into public.client_packages(
    workspace_id,client_id,package_id,package_name_snapshot,price_cents,expires_at,status,created_by
  ) values(
    p_workspace_id,p_client_id,p_package_id,v_package.name,v_package.price_cents,
    case when v_package.validity_days is null then null else now()+make_interval(days=>v_package.validity_days) end,
    'active',auth.uid()
  ) returning id into v_id;
  insert into public.client_package_items(workspace_id,client_package_id,service_id,included_quantity,used_quantity)
  select workspace_id,v_id,service_id,quantity,0 from public.service_package_items
  where workspace_id=p_workspace_id and package_id=p_package_id;
  return v_id;
end;
$$;

create or replace function app.redeem_client_package(
  p_workspace_id uuid,p_client_package_id uuid,p_appointment_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cp public.client_packages%rowtype; v_appt public.appointments%rowtype;
  v_item public.client_package_items%rowtype; v_redemption_id uuid; v_exhausted boolean;
begin
  perform app.assert_package_operator(p_workspace_id);
  select * into v_cp from public.client_packages
  where id=p_client_package_id and workspace_id=p_workspace_id for update;
  if v_cp.id is null then raise exception 'client_package_not_found' using errcode='P0002'; end if;
  if v_cp.status <> 'active' then raise exception 'client_package_not_active' using errcode='22023'; end if;
  if v_cp.expires_at is not null and v_cp.expires_at <= now() then
    raise exception 'client_package_expired' using errcode='22023';
  end if;
  select * into v_appt from public.appointments
  where id=p_appointment_id and workspace_id=p_workspace_id for share;
  if v_appt.id is null then raise exception 'appointment_not_found' using errcode='22023'; end if;
  if v_appt.client_id <> v_cp.client_id then raise exception 'package_client_mismatch' using errcode='22023'; end if;
  if v_appt.status in ('cancelled','no_show') then raise exception 'appointment_not_redeemable' using errcode='22023'; end if;
  select * into v_item from public.client_package_items
  where client_package_id=v_cp.id and workspace_id=p_workspace_id and service_id=v_appt.service_id for update;
  if v_item.id is null then raise exception 'service_not_in_package' using errcode='22023'; end if;
  if v_item.used_quantity >= v_item.included_quantity then raise exception 'package_service_exhausted' using errcode='22023'; end if;
  insert into public.package_redemptions(
    workspace_id,client_package_id,client_package_item_id,appointment_id,quantity,created_by
  ) values(p_workspace_id,v_cp.id,v_item.id,v_appt.id,1,auth.uid()) returning id into v_redemption_id;
  update public.client_package_items set used_quantity=used_quantity+1
  where id=v_item.id and workspace_id=p_workspace_id;
  select not exists(
    select 1 from public.client_package_items i
    where i.client_package_id=v_cp.id and i.workspace_id=p_workspace_id and i.used_quantity<i.included_quantity
  ) into v_exhausted;
  if v_exhausted then update public.client_packages set status='exhausted'
    where id=v_cp.id and workspace_id=p_workspace_id; end if;
  return jsonb_build_object(
    'redemption_id',v_redemption_id,'client_package_id',v_cp.id,'appointment_id',v_appt.id,
    'remaining',v_item.included_quantity-(v_item.used_quantity+1),'package_exhausted',v_exhausted
  );
end;
$$;

create or replace function app.cancel_client_package(p_workspace_id uuid,p_client_package_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  perform app.assert_package_manager(p_workspace_id);
  update public.client_packages set status='cancelled'
  where id=p_client_package_id and workspace_id=p_workspace_id and status='active';
  if not found then raise exception 'client_package_not_active' using errcode='22023'; end if;
  return p_client_package_id;
end;
$$;

alter table public.service_packages enable row level security;
alter table public.service_packages force row level security;
alter table public.service_package_items enable row level security;
alter table public.service_package_items force row level security;
alter table public.client_packages enable row level security;
alter table public.client_packages force row level security;
alter table public.client_package_items enable row level security;
alter table public.client_package_items force row level security;
alter table public.package_redemptions enable row level security;
alter table public.package_redemptions force row level security;

revoke all on public.service_packages from public,anon,authenticated;
revoke all on public.service_package_items from public,anon,authenticated;
revoke all on public.client_packages from public,anon,authenticated;
revoke all on public.client_package_items from public,anon,authenticated;
revoke all on public.package_redemptions from public,anon,authenticated;

grant select on public.service_packages to authenticated;
grant select on public.service_package_items to authenticated;
grant select on public.client_packages to authenticated;
grant select on public.client_package_items to authenticated;
grant select on public.package_redemptions to authenticated;

create policy service_packages_select_member on public.service_packages
for select to authenticated using ((select app.is_workspace_member(workspace_id)));
create policy service_package_items_select_member on public.service_package_items
for select to authenticated using ((select app.is_workspace_member(workspace_id)));
create policy client_packages_select_member on public.client_packages
for select to authenticated using ((select app.is_workspace_member(workspace_id)));
create policy client_package_items_select_member on public.client_package_items
for select to authenticated using ((select app.is_workspace_member(workspace_id)));
create policy package_redemptions_select_member on public.package_redemptions
for select to authenticated using ((select app.is_workspace_member(workspace_id)));

create or replace function public.create_service_package(
  p_workspace_id uuid,p_name text,p_description text,p_price_cents integer,p_validity_days integer,p_items jsonb
) returns uuid language sql security definer set search_path='' as $$
select app.create_service_package(p_workspace_id,p_name,p_description,p_price_cents,p_validity_days,p_items); $$;
create or replace function public.update_service_package(
  p_workspace_id uuid,p_package_id uuid,p_name text,p_description text,p_price_cents integer,
  p_validity_days integer,p_active boolean,p_items jsonb
) returns uuid language sql security definer set search_path='' as $$
select app.update_service_package(p_workspace_id,p_package_id,p_name,p_description,p_price_cents,p_validity_days,p_active,p_items); $$;
create or replace function public.archive_service_package(p_workspace_id uuid,p_package_id uuid)
returns uuid language sql security definer set search_path='' as $$
select app.archive_service_package(p_workspace_id,p_package_id); $$;
create or replace function public.reactivate_service_package(p_workspace_id uuid,p_package_id uuid)
returns uuid language sql security definer set search_path='' as $$
select app.reactivate_service_package(p_workspace_id,p_package_id); $$;
create or replace function public.sell_service_package(p_workspace_id uuid,p_client_id uuid,p_package_id uuid)
returns uuid language sql security definer set search_path='' as $$
select app.sell_service_package(p_workspace_id,p_client_id,p_package_id); $$;
create or replace function public.redeem_client_package(p_workspace_id uuid,p_client_package_id uuid,p_appointment_id uuid)
returns jsonb language sql security definer set search_path='' as $$
select app.redeem_client_package(p_workspace_id,p_client_package_id,p_appointment_id); $$;
create or replace function public.cancel_client_package(p_workspace_id uuid,p_client_package_id uuid)
returns uuid language sql security definer set search_path='' as $$
select app.cancel_client_package(p_workspace_id,p_client_package_id); $$;

revoke all on function app.touch_package_updated_at() from public,anon,authenticated;
revoke all on function app.assert_package_manager(uuid) from public,anon,authenticated;
revoke all on function app.assert_package_operator(uuid) from public,anon,authenticated;
revoke all on function app.replace_service_package_items(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function app.create_service_package(uuid,text,text,integer,integer,jsonb) from public,anon,authenticated;
revoke all on function app.update_service_package(uuid,uuid,text,text,integer,integer,boolean,jsonb) from public,anon,authenticated;
revoke all on function app.archive_service_package(uuid,uuid) from public,anon,authenticated;
revoke all on function app.reactivate_service_package(uuid,uuid) from public,anon,authenticated;
revoke all on function app.sell_service_package(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function app.redeem_client_package(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function app.cancel_client_package(uuid,uuid) from public,anon,authenticated;

revoke all on function public.create_service_package(uuid,text,text,integer,integer,jsonb) from public,anon;
revoke all on function public.update_service_package(uuid,uuid,text,text,integer,integer,boolean,jsonb) from public,anon;
revoke all on function public.archive_service_package(uuid,uuid) from public,anon;
revoke all on function public.reactivate_service_package(uuid,uuid) from public,anon;
revoke all on function public.sell_service_package(uuid,uuid,uuid) from public,anon;
revoke all on function public.redeem_client_package(uuid,uuid,uuid) from public,anon;
revoke all on function public.cancel_client_package(uuid,uuid) from public,anon;

grant execute on function public.create_service_package(uuid,text,text,integer,integer,jsonb) to authenticated;
grant execute on function public.update_service_package(uuid,uuid,text,text,integer,integer,boolean,jsonb) to authenticated;
grant execute on function public.archive_service_package(uuid,uuid) to authenticated;
grant execute on function public.reactivate_service_package(uuid,uuid) to authenticated;
grant execute on function public.sell_service_package(uuid,uuid,uuid) to authenticated;
grant execute on function public.redeem_client_package(uuid,uuid,uuid) to authenticated;
grant execute on function public.cancel_client_package(uuid,uuid) to authenticated;
