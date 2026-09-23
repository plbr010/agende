
create type public.financial_entry_type as enum ('income','expense');
create type public.financial_entry_status as enum ('pending','paid','cancelled');
create type public.financial_entry_source as enum ('manual','appointment','package_sale');
create type public.payment_method as enum ('cash','pix','debit_card','credit_card','bank_transfer','other');

create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entry_type public.financial_entry_type not null,
  status public.financial_entry_status not null default 'pending',
  source public.financial_entry_source not null default 'manual',
  description text not null,
  amount_cents integer not null,
  due_date date,
  paid_at timestamptz,
  payment_method public.payment_method,
  appointment_id uuid,
  client_package_id uuid,
  client_id uuid,
  created_by uuid references public.profiles(user_id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_entries_description_len check (char_length(btrim(description)) between 2 and 200),
  constraint financial_entries_amount check (amount_cents > 0 and amount_cents <= 1000000000),
  constraint financial_entries_paid_shape check (
    (status='paid' and paid_at is not null and payment_method is not null and cancelled_at is null)
    or (status='pending' and paid_at is null and payment_method is null and cancelled_at is null)
    or (status='cancelled' and paid_at is null and payment_method is null and cancelled_at is not null)
  ),
  constraint financial_entries_source_shape check (
    (source='manual' and appointment_id is null and client_package_id is null)
    or (source='appointment' and appointment_id is not null and client_package_id is null and entry_type='income')
    or (source='package_sale' and appointment_id is null and client_package_id is not null and entry_type='income')
  ),
  constraint financial_entries_appointment_fk foreign key (appointment_id, workspace_id)
    references public.appointments(id, workspace_id) on delete restrict,
  constraint financial_entries_client_package_fk foreign key (client_package_id, workspace_id)
    references public.client_packages(id, workspace_id) on delete restrict,
  constraint financial_entries_client_fk foreign key (client_id, workspace_id)
    references public.workspace_clients(id, workspace_id) on delete restrict,
  constraint financial_entries_id_workspace_key unique (id, workspace_id)
);

create unique index financial_entries_appointment_unique
on public.financial_entries(appointment_id)
where source='appointment' and appointment_id is not null;

create unique index financial_entries_package_sale_unique
on public.financial_entries(client_package_id)
where source='package_sale' and client_package_id is not null;

create index financial_entries_workspace_created_idx
on public.financial_entries(workspace_id, created_at desc);
create index financial_entries_workspace_status_due_idx
on public.financial_entries(workspace_id, status, due_date);
create index financial_entries_client_workspace_idx
on public.financial_entries(client_id, workspace_id);
create index financial_entries_created_by_idx
on public.financial_entries(created_by);
create index financial_entries_appointment_workspace_idx
on public.financial_entries(appointment_id, workspace_id);
create index financial_entries_client_package_workspace_idx
on public.financial_entries(client_package_id, workspace_id);

create or replace function app.touch_financial_entry_updated_at()
returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now(); return new; end;
$$;

create trigger financial_entries_touch_updated_at
before update on public.financial_entries
for each row execute function app.touch_financial_entry_updated_at();

create or replace function app.assert_finance_manager(p_workspace_id uuid)
returns void language plpgsql stable security definer set search_path='' as $$
begin
  perform app.require_confirmed_email();
  if not app.has_workspace_role(
    p_workspace_id,
    variadic array['owner'::public.member_role,'admin'::public.member_role]
  ) then raise exception 'not_authorized' using errcode='42501'; end if;
end;
$$;

create or replace function app.assert_finance_operator(p_workspace_id uuid)
returns void language plpgsql stable security definer set search_path='' as $$
begin
  perform app.require_confirmed_email();
  if not app.has_workspace_role(
    p_workspace_id,
    variadic array['owner'::public.member_role,'admin'::public.member_role,'receptionist'::public.member_role]
  ) then raise exception 'not_authorized' using errcode='42501'; end if;
end;
$$;

create or replace function app.create_financial_entry(
  p_workspace_id uuid,
  p_entry_type public.financial_entry_type,
  p_description text,
  p_amount_cents integer,
  p_due_date date default null
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform app.assert_finance_manager(p_workspace_id);
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 1000000000 then
    raise exception 'invalid_amount' using errcode='22023';
  end if;
  insert into public.financial_entries(
    workspace_id,entry_type,status,source,description,amount_cents,due_date,created_by
  ) values(
    p_workspace_id,p_entry_type,'pending','manual',btrim(p_description),p_amount_cents,p_due_date,auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function app.update_financial_entry(
  p_workspace_id uuid,p_entry_id uuid,p_description text,p_amount_cents integer,p_due_date date
)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  perform app.assert_finance_manager(p_workspace_id);
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 1000000000 then
    raise exception 'invalid_amount' using errcode='22023';
  end if;
  update public.financial_entries
  set description=btrim(p_description), amount_cents=p_amount_cents, due_date=p_due_date
  where id=p_entry_id and workspace_id=p_workspace_id and source='manual' and status='pending';
  if not found then raise exception 'financial_entry_not_editable' using errcode='22023'; end if;
  return p_entry_id;
end;
$$;

create or replace function app.mark_financial_entry_paid(
  p_workspace_id uuid,p_entry_id uuid,p_payment_method public.payment_method,p_paid_at timestamptz default now()
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_entry public.financial_entries%rowtype;
begin
  perform app.assert_finance_operator(p_workspace_id);
  select * into v_entry from public.financial_entries
  where id=p_entry_id and workspace_id=p_workspace_id for update;
  if v_entry.id is null then raise exception 'financial_entry_not_found' using errcode='P0002'; end if;
  if v_entry.status <> 'pending' then raise exception 'financial_entry_not_pending' using errcode='22023'; end if;
  if v_entry.entry_type='expense' and not app.has_workspace_role(
    p_workspace_id,
    variadic array['owner'::public.member_role,'admin'::public.member_role]
  ) then raise exception 'not_authorized' using errcode='42501'; end if;
  if p_payment_method is null then raise exception 'payment_method_required' using errcode='22023'; end if;
  update public.financial_entries
  set status='paid',paid_at=coalesce(p_paid_at,now()),payment_method=p_payment_method,cancelled_at=null
  where id=v_entry.id and workspace_id=p_workspace_id;
  return v_entry.id;
end;
$$;

create or replace function app.cancel_financial_entry(p_workspace_id uuid,p_entry_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  perform app.assert_finance_manager(p_workspace_id);
  update public.financial_entries
  set status='cancelled',cancelled_at=now(),paid_at=null,payment_method=null
  where id=p_entry_id and workspace_id=p_workspace_id and status='pending';
  if not found then raise exception 'financial_entry_not_cancellable' using errcode='22023'; end if;
  return p_entry_id;
end;
$$;

create or replace function app.reopen_financial_entry(p_workspace_id uuid,p_entry_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  perform app.assert_finance_manager(p_workspace_id);
  update public.financial_entries
  set status='pending',paid_at=null,payment_method=null,cancelled_at=null
  where id=p_entry_id and workspace_id=p_workspace_id and status in ('paid','cancelled');
  if not found then raise exception 'financial_entry_not_reopenable' using errcode='22023'; end if;
  return p_entry_id;
end;
$$;

create or replace function app.finance_on_appointment_completed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='completed'
     and old.status is distinct from new.status
     and not exists(select 1 from public.package_redemptions pr where pr.appointment_id=new.id)
  then
    insert into public.financial_entries(
      workspace_id,entry_type,status,source,description,amount_cents,appointment_id,client_id,created_by
    ) values(
      new.workspace_id,'income','pending','appointment','Atendimento concluído',
      new.price_cents,new.id,new.client_id,new.created_by
    ) on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger appointments_financial_entry
after update of status on public.appointments
for each row execute function app.finance_on_appointment_completed();

create or replace function app.finance_on_package_sale()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.financial_entries(
    workspace_id,entry_type,status,source,description,amount_cents,client_package_id,client_id,created_by
  ) values(
    new.workspace_id,'income','pending','package_sale',
    'Venda de pacote: '||new.package_name_snapshot,new.price_cents,new.id,new.client_id,new.created_by
  ) on conflict do nothing;
  return new;
end;
$$;

create trigger client_packages_financial_entry
after insert on public.client_packages
for each row execute function app.finance_on_package_sale();

create or replace function app.finance_before_package_redemption()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_status public.financial_entry_status;
begin
  select status into v_status
  from public.financial_entries
  where appointment_id=new.appointment_id and source='appointment'
  for update;
  if v_status='paid' then
    raise exception 'appointment_already_paid' using errcode='22023';
  elsif v_status='pending' then
    update public.financial_entries
    set status='cancelled',cancelled_at=now(),paid_at=null,payment_method=null
    where appointment_id=new.appointment_id and source='appointment';
  end if;
  return new;
end;
$$;

create trigger package_redemptions_financial_guard
before insert on public.package_redemptions
for each row execute function app.finance_before_package_redemption();

create or replace function app.finance_on_package_cancelled()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='cancelled' and old.status is distinct from new.status then
    update public.financial_entries
    set status='cancelled',cancelled_at=now(),paid_at=null,payment_method=null
    where client_package_id=new.id and source='package_sale' and status='pending';
  end if;
  return new;
end;
$$;

create trigger client_packages_financial_cancel
after update of status on public.client_packages
for each row execute function app.finance_on_package_cancelled();

alter table public.financial_entries enable row level security;
alter table public.financial_entries force row level security;
revoke all on public.financial_entries from public,anon,authenticated;
grant select on public.financial_entries to authenticated;

create policy financial_entries_select_finance_roles on public.financial_entries
for select to authenticated
using (
  (select app.has_workspace_role(
    workspace_id,
    variadic array['owner'::public.member_role,'admin'::public.member_role,'receptionist'::public.member_role]
  ))
);

create or replace function public.create_financial_entry(
  p_workspace_id uuid,p_entry_type public.financial_entry_type,p_description text,
  p_amount_cents integer,p_due_date date default null
) returns uuid language sql security definer set search_path='' as $$
select app.create_financial_entry(p_workspace_id,p_entry_type,p_description,p_amount_cents,p_due_date); $$;

create or replace function public.update_financial_entry(
  p_workspace_id uuid,p_entry_id uuid,p_description text,p_amount_cents integer,p_due_date date
) returns uuid language sql security definer set search_path='' as $$
select app.update_financial_entry(p_workspace_id,p_entry_id,p_description,p_amount_cents,p_due_date); $$;

create or replace function public.mark_financial_entry_paid(
  p_workspace_id uuid,p_entry_id uuid,p_payment_method public.payment_method,p_paid_at timestamptz default now()
) returns uuid language sql security definer set search_path='' as $$
select app.mark_financial_entry_paid(p_workspace_id,p_entry_id,p_payment_method,p_paid_at); $$;

create or replace function public.cancel_financial_entry(p_workspace_id uuid,p_entry_id uuid)
returns uuid language sql security definer set search_path='' as $$
select app.cancel_financial_entry(p_workspace_id,p_entry_id); $$;

create or replace function public.reopen_financial_entry(p_workspace_id uuid,p_entry_id uuid)
returns uuid language sql security definer set search_path='' as $$
select app.reopen_financial_entry(p_workspace_id,p_entry_id); $$;

revoke all on function app.touch_financial_entry_updated_at() from public,anon,authenticated;
revoke all on function app.assert_finance_manager(uuid) from public,anon,authenticated;
revoke all on function app.assert_finance_operator(uuid) from public,anon,authenticated;
revoke all on function app.create_financial_entry(uuid,public.financial_entry_type,text,integer,date) from public,anon,authenticated;
revoke all on function app.update_financial_entry(uuid,uuid,text,integer,date) from public,anon,authenticated;
revoke all on function app.mark_financial_entry_paid(uuid,uuid,public.payment_method,timestamptz) from public,anon,authenticated;
revoke all on function app.cancel_financial_entry(uuid,uuid) from public,anon,authenticated;
revoke all on function app.reopen_financial_entry(uuid,uuid) from public,anon,authenticated;
revoke all on function app.finance_on_appointment_completed() from public,anon,authenticated;
revoke all on function app.finance_on_package_sale() from public,anon,authenticated;
revoke all on function app.finance_before_package_redemption() from public,anon,authenticated;
revoke all on function app.finance_on_package_cancelled() from public,anon,authenticated;

revoke all on function public.create_financial_entry(uuid,public.financial_entry_type,text,integer,date) from public,anon;
revoke all on function public.update_financial_entry(uuid,uuid,text,integer,date) from public,anon;
revoke all on function public.mark_financial_entry_paid(uuid,uuid,public.payment_method,timestamptz) from public,anon;
revoke all on function public.cancel_financial_entry(uuid,uuid) from public,anon;
revoke all on function public.reopen_financial_entry(uuid,uuid) from public,anon;

grant execute on function public.create_financial_entry(uuid,public.financial_entry_type,text,integer,date) to authenticated;
grant execute on function public.update_financial_entry(uuid,uuid,text,integer,date) to authenticated;
grant execute on function public.mark_financial_entry_paid(uuid,uuid,public.payment_method,timestamptz) to authenticated;
grant execute on function public.cancel_financial_entry(uuid,uuid) to authenticated;
grant execute on function public.reopen_financial_entry(uuid,uuid) to authenticated;
