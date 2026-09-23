
create table public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  entry_type public.financial_entry_type not null,
  system_key text,
  active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_categories_name_len
    check (char_length(btrim(name)) between 2 and 80),
  constraint financial_categories_system_key_len
    check (system_key is null or char_length(system_key) between 2 and 80),
  constraint financial_categories_archived_inactive
    check (archived_at is null or active=false),
  constraint financial_categories_id_workspace_key unique(id,workspace_id),
  constraint financial_categories_system_key_unique unique(workspace_id,system_key)
);

create unique index financial_categories_name_unique_idx
  on public.financial_categories(workspace_id,entry_type,lower(name))
  where archived_at is null;

create index financial_categories_workspace_type_idx
  on public.financial_categories(workspace_id,entry_type,active);

create index financial_categories_created_by_idx
  on public.financial_categories(created_by);

alter table public.financial_categories enable row level security;
alter table public.financial_categories force row level security;

revoke all on public.financial_categories from public,anon,authenticated;
grant select on public.financial_categories to authenticated;

create policy financial_categories_select_finance_roles
on public.financial_categories
for select to authenticated
using (
  (select app.has_workspace_role(
    workspace_id,
    variadic array[
      'owner'::public.member_role,
      'admin'::public.member_role,
      'receptionist'::public.member_role
    ]
  ))
);

alter table public.financial_entries
  add column category_id uuid,
  add column idempotency_key text;

alter table public.financial_entries
  add constraint financial_entries_category_fk
  foreign key(category_id,workspace_id)
  references public.financial_categories(id,workspace_id)
  on delete restrict;

alter table public.financial_entries
  add constraint financial_entries_idempotency_len
  check (idempotency_key is null or char_length(idempotency_key) between 8 and 120);

alter table public.financial_entries
  add constraint financial_entries_workspace_idempotency_unique
  unique(workspace_id,idempotency_key);

create index financial_entries_category_workspace_idx
  on public.financial_entries(category_id,workspace_id);

alter table public.financial_refunds
  add column idempotency_key text;

alter table public.financial_refunds
  add constraint financial_refunds_idempotency_len
  check (idempotency_key is null or char_length(idempotency_key) between 8 and 120);

alter table public.financial_refunds
  add constraint financial_refunds_workspace_idempotency_unique
  unique(workspace_id,idempotency_key);

create or replace function app.touch_financial_category_updated_at()
returns trigger language plpgsql set search_path='' as $$
begin new.updated_at:=now(); return new; end;
$$;

create trigger financial_categories_touch_updated_at
before update on public.financial_categories
for each row execute function app.touch_financial_category_updated_at();

create or replace function app.seed_financial_categories(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.financial_categories(workspace_id,name,entry_type,system_key)
  values
    (p_workspace_id,'Serviços','income','service_income'),
    (p_workspace_id,'Pacotes','income','package_income'),
    (p_workspace_id,'Outras receitas','income','other_income'),
    (p_workspace_id,'Produtos e materiais','expense','products_expense'),
    (p_workspace_id,'Aluguel e estrutura','expense','rent_expense'),
    (p_workspace_id,'Equipe','expense','team_expense'),
    (p_workspace_id,'Marketing','expense','marketing_expense'),
    (p_workspace_id,'Impostos e taxas','expense','tax_expense'),
    (p_workspace_id,'Outras despesas','expense','other_expense')
  on conflict (workspace_id,system_key) do nothing;
end;
$$;

select app.seed_financial_categories(id)
from public.workspaces;

create or replace function app.seed_financial_categories_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  perform app.seed_financial_categories(new.id);
  return new;
end;
$$;

create trigger workspaces_seed_financial_categories
after insert on public.workspaces
for each row execute function app.seed_financial_categories_trigger();

create or replace function app.assert_financial_category(
  p_workspace_id uuid,
  p_category_id uuid,
  p_entry_type public.financial_entry_type
)
returns void
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if p_category_id is null then return; end if;

  if not exists(
    select 1 from public.financial_categories c
    where c.id=p_category_id
      and c.workspace_id=p_workspace_id
      and c.entry_type=p_entry_type
      and c.active
      and c.archived_at is null
  ) then
    raise exception 'invalid_financial_category' using errcode='22023';
  end if;
end;
$$;

create or replace function app.create_financial_category(
  p_workspace_id uuid,
  p_name text,
  p_entry_type public.financial_entry_type
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid;
begin
  perform app.assert_finance_manager(p_workspace_id);

  insert into public.financial_categories(
    workspace_id,name,entry_type,created_by
  ) values(
    p_workspace_id,btrim(p_name),p_entry_type,auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function app.update_financial_category(
  p_workspace_id uuid,
  p_category_id uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
begin
  perform app.assert_finance_manager(p_workspace_id);

  update public.financial_categories
  set name=btrim(p_name)
  where id=p_category_id
    and workspace_id=p_workspace_id
    and archived_at is null;

  if not found then
    raise exception 'financial_category_not_found' using errcode='P0002';
  end if;

  return p_category_id;
end;
$$;

create or replace function app.archive_financial_category(
  p_workspace_id uuid,
  p_category_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_system_key text;
begin
  perform app.assert_finance_manager(p_workspace_id);

  select system_key into v_system_key
  from public.financial_categories
  where id=p_category_id and workspace_id=p_workspace_id
  for update;

  if not found then
    raise exception 'financial_category_not_found' using errcode='P0002';
  end if;

  if v_system_key is not null then
    raise exception 'system_category_cannot_be_archived' using errcode='22023';
  end if;

  update public.financial_categories
  set active=false,archived_at=now()
  where id=p_category_id and workspace_id=p_workspace_id;

  return p_category_id;
end;
$$;

drop function public.create_financial_entry(
  uuid,public.financial_entry_type,text,integer,date
);
drop function app.create_financial_entry(
  uuid,public.financial_entry_type,text,integer,date
);

create or replace function app.create_financial_entry(
  p_workspace_id uuid,
  p_entry_type public.financial_entry_type,
  p_description text,
  p_amount_cents integer,
  p_due_date date default null,
  p_category_id uuid default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_key text:=nullif(btrim(coalesce(p_idempotency_key,'')),'');
  v_existing public.financial_entries%rowtype;
begin
  perform app.assert_finance_manager(p_workspace_id);
  perform app.assert_financial_category(p_workspace_id,p_category_id,p_entry_type);

  if p_amount_cents is null or p_amount_cents<=0 or p_amount_cents>1000000000 then
    raise exception 'invalid_amount' using errcode='22023';
  end if;

  if v_key is not null and char_length(v_key) not between 8 and 120 then
    raise exception 'invalid_idempotency_key' using errcode='22023';
  end if;

  if v_key is not null then
    select * into v_existing
    from public.financial_entries
    where workspace_id=p_workspace_id
      and idempotency_key=v_key
    for update;

    if v_existing.id is not null then
      if v_existing.source<>'manual'::public.financial_entry_source
         or v_existing.entry_type<>p_entry_type
         or v_existing.description<>btrim(p_description)
         or v_existing.amount_cents<>p_amount_cents
         or v_existing.due_date is distinct from p_due_date
         or v_existing.category_id is distinct from p_category_id then
        raise exception 'idempotency_key_conflict' using errcode='22023';
      end if;
      return v_existing.id;
    end if;
  end if;

  begin
    insert into public.financial_entries(
      workspace_id,entry_type,status,source,description,amount_cents,
      due_date,category_id,idempotency_key,created_by
    ) values(
      p_workspace_id,p_entry_type,'pending','manual',btrim(p_description),p_amount_cents,
      p_due_date,p_category_id,v_key,auth.uid()
    )
    returning id into v_id;
  exception when unique_violation then
    if v_key is null then raise; end if;

    select * into v_existing
    from public.financial_entries
    where workspace_id=p_workspace_id
      and idempotency_key=v_key;

    if v_existing.id is null
       or v_existing.source<>'manual'::public.financial_entry_source
       or v_existing.entry_type<>p_entry_type
       or v_existing.description<>btrim(p_description)
       or v_existing.amount_cents<>p_amount_cents
       or v_existing.due_date is distinct from p_due_date
       or v_existing.category_id is distinct from p_category_id then
      raise exception 'idempotency_key_conflict' using errcode='22023';
    end if;

    return v_existing.id;
  end;

  return v_id;
end;
$$;

create or replace function public.create_financial_entry(
  p_workspace_id uuid,
  p_entry_type public.financial_entry_type,
  p_description text,
  p_amount_cents integer,
  p_due_date date default null,
  p_category_id uuid default null,
  p_idempotency_key text default null
)
returns uuid
language sql
security definer
set search_path=''
as $$
  select app.create_financial_entry(
    p_workspace_id,p_entry_type,p_description,p_amount_cents,
    p_due_date,p_category_id,p_idempotency_key
  );
$$;

drop function public.refund_financial_entry(
  uuid,uuid,integer,text,public.payment_method,timestamptz
);
drop function app.refund_financial_entry(
  uuid,uuid,integer,text,public.payment_method,timestamptz
);

create or replace function app.refund_financial_entry(
  p_workspace_id uuid,
  p_entry_id uuid,
  p_amount_cents integer,
  p_reason text,
  p_payment_method public.payment_method,
  p_refunded_at timestamptz default now(),
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_entry public.financial_entries%rowtype;
  v_refunded integer;
  v_refund_id uuid;
  v_total_after integer;
  v_key text:=nullif(btrim(coalesce(p_idempotency_key,'')),'');
  v_existing public.financial_refunds%rowtype;
begin
  perform app.assert_finance_manager(p_workspace_id);

  if v_key is not null and char_length(v_key) not between 8 and 120 then
    raise exception 'invalid_idempotency_key' using errcode='22023';
  end if;

  if v_key is not null then
    select * into v_existing
    from public.financial_refunds
    where workspace_id=p_workspace_id
      and idempotency_key=v_key
    for update;

    if v_existing.id is not null then
      if v_existing.financial_entry_id<>p_entry_id
         or v_existing.amount_cents<>p_amount_cents
         or v_existing.reason<>btrim(p_reason)
         or v_existing.payment_method<>p_payment_method then
        raise exception 'idempotency_key_conflict' using errcode='22023';
      end if;
      return v_existing.id;
    end if;
  end if;

  select * into v_entry
  from public.financial_entries
  where id=p_entry_id
    and workspace_id=p_workspace_id
  for update;

  if v_entry.id is null then
    raise exception 'financial_entry_not_found' using errcode='P0002';
  end if;

  if v_entry.entry_type<>'income'::public.financial_entry_type
     or v_entry.status<>'paid'::public.financial_entry_status then
    raise exception 'financial_entry_not_refundable' using errcode='22023';
  end if;

  if p_amount_cents is null or p_amount_cents<=0 then
    raise exception 'invalid_refund_amount' using errcode='22023';
  end if;

  if p_payment_method is null then
    raise exception 'refund_payment_method_required' using errcode='22023';
  end if;

  if char_length(btrim(coalesce(p_reason,'')))<3 then
    raise exception 'refund_reason_required' using errcode='22023';
  end if;

  if v_entry.source='package_sale'::public.financial_entry_source
     and v_entry.client_package_id is not null
     and exists(
       select 1 from public.package_redemptions r
       where r.client_package_id=v_entry.client_package_id
         and r.workspace_id=p_workspace_id
         and r.reversed_at is null
     ) then
    raise exception 'package_has_active_redemptions' using errcode='22023';
  end if;

  select coalesce(sum(r.amount_cents),0)::integer
  into v_refunded
  from public.financial_refunds r
  where r.financial_entry_id=v_entry.id
    and r.workspace_id=p_workspace_id;

  if v_refunded+p_amount_cents>v_entry.amount_cents then
    raise exception 'refund_exceeds_paid_amount' using errcode='22023';
  end if;

  begin
    insert into public.financial_refunds(
      workspace_id,financial_entry_id,amount_cents,reason,payment_method,
      refunded_at,idempotency_key,created_by
    ) values(
      p_workspace_id,v_entry.id,p_amount_cents,btrim(p_reason),p_payment_method,
      coalesce(p_refunded_at,now()),v_key,auth.uid()
    )
    returning id into v_refund_id;
  exception when unique_violation then
    if v_key is null then raise; end if;

    select * into v_existing
    from public.financial_refunds
    where workspace_id=p_workspace_id
      and idempotency_key=v_key;

    if v_existing.id is null
       or v_existing.financial_entry_id<>p_entry_id
       or v_existing.amount_cents<>p_amount_cents
       or v_existing.reason<>btrim(p_reason)
       or v_existing.payment_method<>p_payment_method then
      raise exception 'idempotency_key_conflict' using errcode='22023';
    end if;

    return v_existing.id;
  end;

  v_total_after:=v_refunded+p_amount_cents;

  if v_entry.source='package_sale'::public.financial_entry_source
     and v_entry.client_package_id is not null
     and v_total_after=v_entry.amount_cents then
    update public.client_packages
    set status='cancelled'::public.client_package_status
    where id=v_entry.client_package_id
      and workspace_id=p_workspace_id
      and status<>'cancelled'::public.client_package_status;
  end if;

  return v_refund_id;
end;
$$;

create or replace function public.refund_financial_entry(
  p_workspace_id uuid,
  p_entry_id uuid,
  p_amount_cents integer,
  p_reason text,
  p_payment_method public.payment_method,
  p_refunded_at timestamptz default now(),
  p_idempotency_key text default null
)
returns uuid
language sql
security definer
set search_path=''
as $$
  select app.refund_financial_entry(
    p_workspace_id,p_entry_id,p_amount_cents,p_reason,
    p_payment_method,p_refunded_at,p_idempotency_key
  );
$$;

create or replace function app.finance_on_appointment_completed()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_category_id uuid;
begin
  if new.status='completed'
     and old.status is distinct from new.status
     and not exists(
       select 1 from public.package_redemptions pr
       where pr.appointment_id=new.id and pr.reversed_at is null
     )
  then
    select id into v_category_id
    from public.financial_categories
    where workspace_id=new.workspace_id
      and system_key='service_income'
    limit 1;

    insert into public.financial_entries(
      workspace_id,entry_type,status,source,description,amount_cents,
      appointment_id,client_id,category_id,created_by
    ) values(
      new.workspace_id,'income','pending','appointment','Atendimento concluído',
      new.price_cents,new.id,new.client_id,v_category_id,new.created_by
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create or replace function app.finance_on_package_sale()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_category_id uuid;
begin
  select id into v_category_id
  from public.financial_categories
  where workspace_id=new.workspace_id
    and system_key='package_income'
  limit 1;

  insert into public.financial_entries(
    workspace_id,entry_type,status,source,description,amount_cents,
    client_package_id,client_id,category_id,created_by
  ) values(
    new.workspace_id,'income','pending','package_sale',
    'Venda de pacote: '||new.package_name_snapshot,
    new.price_cents,new.id,new.client_id,v_category_id,new.created_by
  )
  on conflict do nothing;

  return new;
end;
$$;

create or replace function app.capture_audit_event()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_workspace_id uuid;
  v_entity_id text;
  v_actor uuid;
begin
  v_old:=case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end;
  v_new:=case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end;

  v_workspace_id:=coalesce(
    nullif(v_new->>'workspace_id','')::uuid,
    nullif(v_old->>'workspace_id','')::uuid
  );

  if v_workspace_id is null then
    return case when tg_op='DELETE' then old else new end;
  end if;

  v_entity_id:=coalesce(v_new->>'id',v_old->>'id');
  v_actor:=auth.uid();

  insert into public.audit_events(
    workspace_id,actor_user_id,actor_kind,action,
    entity_type,entity_id,old_data,new_data
  ) values(
    v_workspace_id,v_actor,
    case when v_actor is null then 'public_or_system' else 'user' end,
    tg_op,tg_table_name,v_entity_id,
    app.audit_sanitize(v_old),app.audit_sanitize(v_new)
  );

  return case when tg_op='DELETE' then old else new end;
end;
$$;

create trigger financial_categories_audit
after insert or update or delete on public.financial_categories
for each row execute function app.capture_audit_event();

create or replace function public.create_financial_category(
  p_workspace_id uuid,p_name text,p_entry_type public.financial_entry_type
)
returns uuid language sql security definer set search_path='' as $$
  select app.create_financial_category(p_workspace_id,p_name,p_entry_type);
$$;

create or replace function public.update_financial_category(
  p_workspace_id uuid,p_category_id uuid,p_name text
)
returns uuid language sql security definer set search_path='' as $$
  select app.update_financial_category(p_workspace_id,p_category_id,p_name);
$$;

create or replace function public.archive_financial_category(
  p_workspace_id uuid,p_category_id uuid
)
returns uuid language sql security definer set search_path='' as $$
  select app.archive_financial_category(p_workspace_id,p_category_id);
$$;

revoke all on function app.touch_financial_category_updated_at() from public,anon,authenticated;
revoke all on function app.seed_financial_categories(uuid) from public,anon,authenticated;
revoke all on function app.seed_financial_categories_trigger() from public,anon,authenticated;
revoke all on function app.assert_financial_category(uuid,uuid,public.financial_entry_type) from public,anon,authenticated;
revoke all on function app.create_financial_category(uuid,text,public.financial_entry_type) from public,anon,authenticated;
revoke all on function app.update_financial_category(uuid,uuid,text) from public,anon,authenticated;
revoke all on function app.archive_financial_category(uuid,uuid) from public,anon,authenticated;
revoke all on function app.create_financial_entry(uuid,public.financial_entry_type,text,integer,date,uuid,text) from public,anon,authenticated;
revoke all on function app.refund_financial_entry(uuid,uuid,integer,text,public.payment_method,timestamptz,text) from public,anon,authenticated;

revoke all on function public.create_financial_category(uuid,text,public.financial_entry_type) from public,anon;
revoke all on function public.update_financial_category(uuid,uuid,text) from public,anon;
revoke all on function public.archive_financial_category(uuid,uuid) from public,anon;
revoke all on function public.create_financial_entry(uuid,public.financial_entry_type,text,integer,date,uuid,text) from public,anon;
revoke all on function public.refund_financial_entry(uuid,uuid,integer,text,public.payment_method,timestamptz,text) from public,anon;

grant execute on function public.create_financial_category(uuid,text,public.financial_entry_type) to authenticated;
grant execute on function public.update_financial_category(uuid,uuid,text) to authenticated;
grant execute on function public.archive_financial_category(uuid,uuid) to authenticated;
grant execute on function public.create_financial_entry(uuid,public.financial_entry_type,text,integer,date,uuid,text) to authenticated;
grant execute on function public.refund_financial_entry(uuid,uuid,integer,text,public.payment_method,timestamptz,text) to authenticated;
