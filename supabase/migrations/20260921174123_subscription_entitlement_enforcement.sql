
create or replace function app.workspace_has_entitlement(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.workspace_id = p_workspace_id
      and (
        (
          s.status = 'trialing'::public.subscription_status
          and s.trial_ends_at is not null
          and s.trial_ends_at > now()
        )
        or
        (
          s.status = 'active'::public.subscription_status
          and (s.current_period_end is null or s.current_period_end > now())
        )
      )
  );
$$;

create or replace function app.assert_workspace_entitled(p_workspace_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not app.workspace_has_entitlement(p_workspace_id) then
    raise exception 'workspace_subscription_inactive' using errcode = '42501';
  end if;
end;
$$;

create or replace function app.enforce_workspace_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
begin
  if current_setting('app.bypass_entitlement', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_workspace_id := case
    when tg_op = 'DELETE' then old.workspace_id
    else new.workspace_id
  end;

  perform app.assert_workspace_entitled(v_workspace_id);

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function app.actor_member(p_workspace_id uuid)
returns public.workspace_members
language plpgsql
stable
set search_path = ''
as $$
declare
  v_row public.workspace_members;
begin
  perform app.assert_workspace_entitled(p_workspace_id);

  select m.* into v_row
  from public.workspace_members m
  where m.workspace_id = p_workspace_id
    and m.user_id = auth.uid()
    and m.status = 'active';

  if v_row.id is null then
    raise exception 'not_workspace_member' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

create or replace function app.require_workspace_manager(p_workspace_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  v_uid := app.require_confirmed_email();
  perform app.assert_workspace_entitled(p_workspace_id);

  if not app.has_workspace_role(
    p_workspace_id,
    variadic array['owner'::public.member_role, 'admin'::public.member_role]
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return v_uid;
end;
$$;

create or replace function app.assert_inventory_manager(p_workspace_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.assert_workspace_entitled(p_workspace_id);
  if not app.has_workspace_role(
    p_workspace_id,
    variadic array['owner'::public.member_role, 'admin'::public.member_role]
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
end;
$$;

create or replace function app.assert_inventory_mover(
  p_workspace_id uuid,
  p_type public.inventory_movement_type
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.assert_workspace_entitled(p_workspace_id);

  if p_type = 'adjustment'::public.inventory_movement_type then
    perform app.assert_inventory_manager(p_workspace_id);
    return;
  end if;

  if not app.has_workspace_role(
    p_workspace_id,
    variadic array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'receptionist'::public.member_role
    ]
  ) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
end;
$$;

create or replace function app.assert_package_manager(p_workspace_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require_confirmed_email();
  perform app.assert_workspace_entitled(p_workspace_id);

  if not app.has_workspace_role(
    p_workspace_id,
    variadic array['owner'::public.member_role,'admin'::public.member_role]
  ) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
end;
$$;

create or replace function app.assert_package_operator(p_workspace_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require_confirmed_email();
  perform app.assert_workspace_entitled(p_workspace_id);

  if not app.has_workspace_role(
    p_workspace_id,
    variadic array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'receptionist'::public.member_role
    ]
  ) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
end;
$$;

create or replace function app.assert_finance_manager(p_workspace_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require_confirmed_email();
  perform app.assert_workspace_entitled(p_workspace_id);

  if not app.has_workspace_role(
    p_workspace_id,
    variadic array['owner'::public.member_role,'admin'::public.member_role]
  ) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
end;
$$;

create or replace function app.assert_finance_operator(p_workspace_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app.require_confirmed_email();
  perform app.assert_workspace_entitled(p_workspace_id);

  if not app.has_workspace_role(
    p_workspace_id,
    variadic array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'receptionist'::public.member_role
    ]
  ) then
    raise exception 'not_authorized' using errcode='42501';
  end if;
end;
$$;

create or replace function app.resolve_public_workspace(p_slug text)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_id uuid;
  v_slug text := lower(btrim(coalesce(p_slug, '')));
begin
  if v_slug = '' then
    raise exception 'workspace_not_found' using errcode = '22023';
  end if;

  select w.id into v_id
  from public.workspaces w
  where w.slug = v_slug;

  if v_id is null then
    raise exception 'workspace_not_found' using errcode = '22023';
  end if;

  if not app.workspace_has_entitlement(v_id) then
    raise exception 'workspace_unavailable' using errcode = '22023';
  end if;

  return v_id;
end;
$$;

drop trigger if exists services_entitlement_gate on public.services;
create trigger services_entitlement_gate
before insert or update or delete on public.services
for each row execute function app.enforce_workspace_entitlement();

drop trigger if exists professional_services_entitlement_gate on public.professional_services;
create trigger professional_services_entitlement_gate
before insert or update or delete on public.professional_services
for each row execute function app.enforce_workspace_entitlement();

drop trigger if exists professional_working_hours_entitlement_gate on public.professional_working_hours;
create trigger professional_working_hours_entitlement_gate
before insert or update or delete on public.professional_working_hours
for each row execute function app.enforce_workspace_entitlement();

drop trigger if exists professional_breaks_entitlement_gate on public.professional_breaks;
create trigger professional_breaks_entitlement_gate
before insert or update or delete on public.professional_breaks
for each row execute function app.enforce_workspace_entitlement();

drop trigger if exists professional_time_blocks_entitlement_gate on public.professional_time_blocks;
create trigger professional_time_blocks_entitlement_gate
before insert or update or delete on public.professional_time_blocks
for each row execute function app.enforce_workspace_entitlement();

drop trigger if exists appointments_entitlement_gate on public.appointments;
create trigger appointments_entitlement_gate
before insert or update or delete on public.appointments
for each row execute function app.enforce_workspace_entitlement();

drop trigger if exists inventory_products_entitlement_gate on public.inventory_products;
create trigger inventory_products_entitlement_gate
before insert or update or delete on public.inventory_products
for each row execute function app.enforce_workspace_entitlement();

drop trigger if exists inventory_movements_entitlement_gate on public.inventory_movements;
create trigger inventory_movements_entitlement_gate
before insert or update or delete on public.inventory_movements
for each row execute function app.enforce_workspace_entitlement();

drop trigger if exists service_packages_entitlement_gate on public.service_packages;
create trigger service_packages_entitlement_gate
before insert or update or delete on public.service_packages
for each row execute function app.enforce_workspace_entitlement();

drop trigger if exists service_package_items_entitlement_gate on public.service_package_items;
create trigger service_package_items_entitlement_gate
before insert or update or delete on public.service_package_items
for each row execute function app.enforce_workspace_entitlement();

drop trigger if exists client_packages_entitlement_gate on public.client_packages;
create trigger client_packages_entitlement_gate
before insert or update or delete on public.client_packages
for each row execute function app.enforce_workspace_entitlement();

drop trigger if exists client_package_items_entitlement_gate on public.client_package_items;
create trigger client_package_items_entitlement_gate
before insert or update or delete on public.client_package_items
for each row execute function app.enforce_workspace_entitlement();

drop trigger if exists package_redemptions_entitlement_gate on public.package_redemptions;
create trigger package_redemptions_entitlement_gate
before insert or update or delete on public.package_redemptions
for each row execute function app.enforce_workspace_entitlement();

drop trigger if exists financial_entries_entitlement_gate on public.financial_entries;
create trigger financial_entries_entitlement_gate
before insert or update or delete on public.financial_entries
for each row execute function app.enforce_workspace_entitlement();

drop policy if exists workspace_clients_insert_member on public.workspace_clients;
create policy workspace_clients_insert_member on public.workspace_clients
for insert to authenticated
with check (
  (select app.is_workspace_member(workspace_id))
  and (select app.workspace_has_entitlement(workspace_id))
);

drop policy if exists workspace_clients_update_member on public.workspace_clients;
create policy workspace_clients_update_member on public.workspace_clients
for update to authenticated
using (
  (select app.is_workspace_member(workspace_id))
  and (select app.workspace_has_entitlement(workspace_id))
)
with check (
  (select app.is_workspace_member(workspace_id))
  and (select app.workspace_has_entitlement(workspace_id))
);

drop policy if exists professional_profiles_update_manager_or_own on public.professional_profiles;
create policy professional_profiles_update_manager_or_own on public.professional_profiles
for update to authenticated
using (
  (select app.workspace_has_entitlement(workspace_id))
  and (
    (select app.has_workspace_role(
      workspace_id,
      variadic array['owner'::public.member_role,'admin'::public.member_role]
    ))
    or member_id in (
      select m.id
      from public.workspace_members m
      where m.user_id=(select auth.uid())
        and m.workspace_id=professional_profiles.workspace_id
        and m.status='active'
        and m.role in (
          'owner'::public.member_role,
          'admin'::public.member_role,
          'professional'::public.member_role
        )
    )
  )
)
with check (
  (select app.workspace_has_entitlement(workspace_id))
  and (
    (select app.has_workspace_role(
      workspace_id,
      variadic array['owner'::public.member_role,'admin'::public.member_role]
    ))
    or member_id in (
      select m.id
      from public.workspace_members m
      where m.user_id=(select auth.uid())
        and m.workspace_id=professional_profiles.workspace_id
        and m.status='active'
        and m.role in (
          'owner'::public.member_role,
          'admin'::public.member_role,
          'professional'::public.member_role
        )
    )
  )
);

revoke all on function app.workspace_has_entitlement(uuid) from public, anon, authenticated;
revoke all on function app.assert_workspace_entitled(uuid) from public, anon, authenticated;
revoke all on function app.enforce_workspace_entitlement() from public, anon, authenticated;

grant execute on function app.workspace_has_entitlement(uuid) to authenticated;
