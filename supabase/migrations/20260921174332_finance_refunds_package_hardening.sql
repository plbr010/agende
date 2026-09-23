
create table public.financial_refunds (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  financial_entry_id uuid not null,
  amount_cents integer not null,
  reason text not null,
  payment_method public.payment_method not null,
  refunded_at timestamptz not null default now(),
  created_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  constraint financial_refunds_amount_check
    check (amount_cents > 0 and amount_cents <= 1000000000),
  constraint financial_refunds_reason_len
    check (char_length(btrim(reason)) between 3 and 500),
  constraint financial_refunds_entry_fk
    foreign key (financial_entry_id, workspace_id)
    references public.financial_entries(id, workspace_id)
    on delete restrict
);

create index financial_refunds_workspace_refunded_idx
  on public.financial_refunds(workspace_id, refunded_at desc);

create index financial_refunds_entry_workspace_idx
  on public.financial_refunds(financial_entry_id, workspace_id);

create index financial_refunds_created_by_idx
  on public.financial_refunds(created_by);

alter table public.financial_refunds enable row level security;
alter table public.financial_refunds force row level security;

revoke all on public.financial_refunds from public, anon, authenticated;
grant select on public.financial_refunds to authenticated;

create policy financial_refunds_select_owner_admin
on public.financial_refunds
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

create or replace function app.forbid_financial_refund_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'financial_refund_immutable' using errcode='42501';
end;
$$;

create trigger financial_refunds_immutable
before update or delete on public.financial_refunds
for each row execute function app.forbid_financial_refund_mutation();

create or replace function app.refund_financial_entry(
  p_workspace_id uuid,
  p_entry_id uuid,
  p_amount_cents integer,
  p_reason text,
  p_payment_method public.payment_method,
  p_refunded_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.financial_entries%rowtype;
  v_refunded integer;
  v_refund_id uuid;
  v_total_after integer;
begin
  perform app.assert_finance_manager(p_workspace_id);

  select *
  into v_entry
  from public.financial_entries
  where id=p_entry_id
    and workspace_id=p_workspace_id
  for update;

  if v_entry.id is null then
    raise exception 'financial_entry_not_found' using errcode='P0002';
  end if;

  if v_entry.entry_type <> 'income'::public.financial_entry_type
     or v_entry.status <> 'paid'::public.financial_entry_status then
    raise exception 'financial_entry_not_refundable' using errcode='22023';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_refund_amount' using errcode='22023';
  end if;

  if p_payment_method is null then
    raise exception 'refund_payment_method_required' using errcode='22023';
  end if;

  if char_length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'refund_reason_required' using errcode='22023';
  end if;

  select coalesce(sum(r.amount_cents),0)::integer
  into v_refunded
  from public.financial_refunds r
  where r.financial_entry_id=v_entry.id
    and r.workspace_id=p_workspace_id;

  if v_refunded + p_amount_cents > v_entry.amount_cents then
    raise exception 'refund_exceeds_paid_amount' using errcode='22023';
  end if;

  insert into public.financial_refunds(
    workspace_id,
    financial_entry_id,
    amount_cents,
    reason,
    payment_method,
    refunded_at,
    created_by
  ) values(
    p_workspace_id,
    v_entry.id,
    p_amount_cents,
    btrim(p_reason),
    p_payment_method,
    coalesce(p_refunded_at,now()),
    auth.uid()
  )
  returning id into v_refund_id;

  v_total_after := v_refunded + p_amount_cents;

  if v_entry.source='package_sale'::public.financial_entry_source
     and v_entry.client_package_id is not null
     and v_total_after = v_entry.amount_cents then
    update public.client_packages
    set status='cancelled'::public.client_package_status
    where id=v_entry.client_package_id
      and workspace_id=p_workspace_id
      and status <> 'cancelled'::public.client_package_status;
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
  p_refunded_at timestamptz default now()
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select app.refund_financial_entry(
    p_workspace_id,
    p_entry_id,
    p_amount_cents,
    p_reason,
    p_payment_method,
    p_refunded_at
  );
$$;

revoke all on function app.forbid_financial_refund_mutation() from public, anon, authenticated;
revoke all on function app.refund_financial_entry(
  uuid,uuid,integer,text,public.payment_method,timestamptz
) from public, anon, authenticated;

revoke all on function public.refund_financial_entry(
  uuid,uuid,integer,text,public.payment_method,timestamptz
) from public, anon;

grant execute on function public.refund_financial_entry(
  uuid,uuid,integer,text,public.payment_method,timestamptz
) to authenticated;

create or replace function app.redeem_client_package(
  p_workspace_id uuid,
  p_client_package_id uuid,
  p_appointment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cp public.client_packages%rowtype;
  v_appt public.appointments%rowtype;
  v_item public.client_package_items%rowtype;
  v_redemption_id uuid;
  v_exhausted boolean;
begin
  perform app.assert_package_operator(p_workspace_id);

  select *
  into v_cp
  from public.client_packages
  where id=p_client_package_id
    and workspace_id=p_workspace_id
  for update;

  if v_cp.id is null then
    raise exception 'client_package_not_found' using errcode='P0002';
  end if;

  if v_cp.status <> 'active'::public.client_package_status then
    raise exception 'client_package_not_active' using errcode='22023';
  end if;

  if v_cp.expires_at is not null and v_cp.expires_at <= now() then
    raise exception 'client_package_expired' using errcode='22023';
  end if;

  select *
  into v_appt
  from public.appointments
  where id=p_appointment_id
    and workspace_id=p_workspace_id
  for share;

  if v_appt.id is null then
    raise exception 'appointment_not_found' using errcode='22023';
  end if;

  if v_appt.client_id <> v_cp.client_id then
    raise exception 'package_client_mismatch' using errcode='22023';
  end if;

  if v_appt.status <> 'completed'::public.appointment_status then
    raise exception 'appointment_must_be_completed_for_redemption' using errcode='22023';
  end if;

  select *
  into v_item
  from public.client_package_items
  where client_package_id=v_cp.id
    and workspace_id=p_workspace_id
    and service_id=v_appt.service_id
  for update;

  if v_item.id is null then
    raise exception 'service_not_in_package' using errcode='22023';
  end if;

  if v_item.used_quantity >= v_item.included_quantity then
    raise exception 'package_service_exhausted' using errcode='22023';
  end if;

  insert into public.package_redemptions(
    workspace_id,
    client_package_id,
    client_package_item_id,
    appointment_id,
    quantity,
    created_by
  ) values(
    p_workspace_id,
    v_cp.id,
    v_item.id,
    v_appt.id,
    1,
    auth.uid()
  )
  returning id into v_redemption_id;

  update public.client_package_items
  set used_quantity=used_quantity+1
  where id=v_item.id
    and workspace_id=p_workspace_id;

  select not exists(
    select 1
    from public.client_package_items i
    where i.client_package_id=v_cp.id
      and i.workspace_id=p_workspace_id
      and i.used_quantity<i.included_quantity
  )
  into v_exhausted;

  if v_exhausted then
    update public.client_packages
    set status='exhausted'::public.client_package_status
    where id=v_cp.id
      and workspace_id=p_workspace_id;
  end if;

  return jsonb_build_object(
    'redemption_id',v_redemption_id,
    'client_package_id',v_cp.id,
    'appointment_id',v_appt.id,
    'remaining',v_item.included_quantity-(v_item.used_quantity+1),
    'package_exhausted',v_exhausted
  );
end;
$$;

create or replace function app.get_workspace_report(
  p_workspace_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
  v_paid_income bigint;
  v_pending_income bigint;
  v_paid_expense bigint;
  v_pending_expense bigint;
  v_refunded_income bigint;
  v_result jsonb;
begin
  perform app.assert_finance_manager(p_workspace_id);

  if p_start_date is null or p_end_date is null
     or p_end_date < p_start_date
     or p_end_date - p_start_date > 366 then
    raise exception 'invalid_report_period' using errcode='22023';
  end if;

  v_tz := app.workspace_timezone(p_workspace_id);
  v_start := (p_start_date::timestamp at time zone v_tz);
  v_end := ((p_end_date + 1)::timestamp at time zone v_tz);

  select
    coalesce(sum(amount_cents) filter(where entry_type='income' and status='paid'),0),
    coalesce(sum(amount_cents) filter(where entry_type='income' and status='pending'),0),
    coalesce(sum(amount_cents) filter(where entry_type='expense' and status='paid'),0),
    coalesce(sum(amount_cents) filter(where entry_type='expense' and status='pending'),0)
  into
    v_paid_income,
    v_pending_income,
    v_paid_expense,
    v_pending_expense
  from public.financial_entries f
  where f.workspace_id=p_workspace_id
    and f.created_at>=v_start
    and f.created_at<v_end;

  select coalesce(sum(r.amount_cents),0)
  into v_refunded_income
  from public.financial_refunds r
  where r.workspace_id=p_workspace_id
    and r.refunded_at>=v_start
    and r.refunded_at<v_end;

  v_result := jsonb_build_object(
    'period', jsonb_build_object(
      'start_date',p_start_date,
      'end_date',p_end_date,
      'timezone',v_tz
    ),
    'finance', jsonb_build_object(
      'paid_income_cents',v_paid_income,
      'refunded_income_cents',v_refunded_income,
      'net_collected_income_cents',v_paid_income-v_refunded_income,
      'pending_income_cents',v_pending_income,
      'paid_expense_cents',v_paid_expense,
      'pending_expense_cents',v_pending_expense,
      'net_paid_cents',(v_paid_income-v_refunded_income)-v_paid_expense
    )
  );

  v_result := v_result || jsonb_build_object(
    'appointments', (
      select jsonb_build_object(
        'total',count(*),
        'scheduled',count(*) filter(where status='scheduled'),
        'confirmed',count(*) filter(where status='confirmed'),
        'in_progress',count(*) filter(where status='in_progress'),
        'completed',count(*) filter(where status='completed'),
        'cancelled',count(*) filter(where status='cancelled'),
        'no_show',count(*) filter(where status='no_show')
      )
      from public.appointments a
      where a.workspace_id=p_workspace_id
        and a.starts_at>=v_start
        and a.starts_at<v_end
    ),
    'clients', (
      select jsonb_build_object('new_clients',count(*))
      from public.workspace_clients c
      where c.workspace_id=p_workspace_id
        and c.created_at>=v_start
        and c.created_at<v_end
    ),
    'packages', (
      select jsonb_build_object(
        'sold',count(*),
        'gross_sales_cents',coalesce(sum(price_cents),0),
        'active_now',count(*) filter(
          where status='active' and (expires_at is null or expires_at>now())
        ),
        'expired_now',count(*) filter(
          where status='active' and expires_at is not null and expires_at<=now()
        ),
        'exhausted',count(*) filter(where status='exhausted'),
        'cancelled',count(*) filter(where status='cancelled')
      )
      from public.client_packages cp
      where cp.workspace_id=p_workspace_id
        and cp.purchased_at>=v_start
        and cp.purchased_at<v_end
    ),
    'inventory', (
      select jsonb_build_object(
        'active_products',count(*) filter(where archived_at is null and active),
        'low_stock',count(*) filter(
          where archived_at is null and active
            and quantity>0 and quantity<=minimum_quantity
        ),
        'out_of_stock',count(*) filter(
          where archived_at is null and active and quantity=0
        )
      )
      from public.inventory_products ip
      where ip.workspace_id=p_workspace_id
    ),
    'top_services', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.completed_count desc,x.revenue_cents desc)
      from (
        select
          a.service_id,
          coalesce(s.name,'Serviço') as service_name,
          count(*)::int as completed_count,
          coalesce(sum(a.price_cents),0)::bigint as revenue_cents
        from public.appointments a
        left join public.services s
          on s.id=a.service_id
         and s.workspace_id=a.workspace_id
        where a.workspace_id=p_workspace_id
          and a.starts_at>=v_start
          and a.starts_at<v_end
          and a.status='completed'
        group by a.service_id,s.name
        order by completed_count desc,revenue_cents desc
        limit 5
      ) x
    ),'[]'::jsonb)
  );

  return v_result;
end;
$$;
