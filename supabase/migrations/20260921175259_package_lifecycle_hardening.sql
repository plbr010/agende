
alter type public.client_package_status add value if not exists 'expired';

alter table public.package_redemptions
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references public.profiles(user_id) on delete set null,
  add column if not exists reversal_reason text;

alter table public.package_redemptions
  drop constraint if exists package_redemptions_reversal_shape;

alter table public.package_redemptions
  add constraint package_redemptions_reversal_shape
  check (
    (reversed_at is null and reversed_by is null and reversal_reason is null)
    or (
      reversed_at is not null
      and reversal_reason is not null
      and char_length(btrim(reversal_reason)) between 3 and 500
    )
  );

create index if not exists package_redemptions_reversed_by_idx
  on public.package_redemptions(reversed_by);

create index if not exists package_redemptions_active_package_idx
  on public.package_redemptions(client_package_id, workspace_id)
  where reversed_at is null;

create or replace function app.protect_package_redemption_mutation()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if current_setting('app.package_redemption_mutating', true)='on' then
    return new;
  end if;
  raise exception 'package_redemption_mutation_denied' using errcode='42501';
end;
$$;

drop trigger if exists package_redemptions_protect_update on public.package_redemptions;
create trigger package_redemptions_protect_update
before update on public.package_redemptions
for each row execute function app.protect_package_redemption_mutation();

create or replace function app.reverse_package_redemption(
  p_workspace_id uuid,
  p_redemption_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_r public.package_redemptions%rowtype;
  v_item public.client_package_items%rowtype;
  v_cp public.client_packages%rowtype;
  v_appt public.appointments%rowtype;
  v_fin public.financial_entries%rowtype;
  v_new_status public.client_package_status;
begin
  perform app.assert_package_manager(p_workspace_id);

  if char_length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'reversal_reason_required' using errcode='22023';
  end if;

  select * into v_r
  from public.package_redemptions
  where id=p_redemption_id
    and workspace_id=p_workspace_id
  for update;

  if v_r.id is null then
    raise exception 'package_redemption_not_found' using errcode='P0002';
  end if;

  if v_r.reversed_at is not null then
    raise exception 'package_redemption_already_reversed' using errcode='22023';
  end if;

  select * into v_item
  from public.client_package_items
  where id=v_r.client_package_item_id
    and workspace_id=p_workspace_id
  for update;

  select * into v_cp
  from public.client_packages
  where id=v_r.client_package_id
    and workspace_id=p_workspace_id
  for update;

  select * into v_appt
  from public.appointments
  where id=v_r.appointment_id
    and workspace_id=p_workspace_id
  for share;

  if v_item.id is null or v_cp.id is null or v_appt.id is null then
    raise exception 'package_redemption_integrity_error' using errcode='22023';
  end if;

  if v_item.used_quantity <= 0 then
    raise exception 'package_item_usage_invalid' using errcode='22023';
  end if;

  update public.client_package_items
  set used_quantity=used_quantity-1
  where id=v_item.id
    and workspace_id=p_workspace_id;

  if v_cp.status='cancelled'::public.client_package_status then
    v_new_status := 'cancelled'::public.client_package_status;
  elsif v_cp.expires_at is not null and v_cp.expires_at <= now() then
    v_new_status := 'expired'::public.client_package_status;
  else
    v_new_status := 'active'::public.client_package_status;
  end if;

  update public.client_packages
  set status=v_new_status
  where id=v_cp.id
    and workspace_id=p_workspace_id;

  perform set_config('app.package_redemption_mutating','on',true);
  update public.package_redemptions
  set reversed_at=now(),
      reversed_by=auth.uid(),
      reversal_reason=btrim(p_reason)
  where id=v_r.id
    and workspace_id=p_workspace_id;
  perform set_config('app.package_redemption_mutating','off',true);

  select * into v_fin
  from public.financial_entries
  where appointment_id=v_appt.id
    and workspace_id=p_workspace_id
    and source='appointment'::public.financial_entry_source
  for update;

  if v_fin.id is null then
    insert into public.financial_entries(
      workspace_id,entry_type,status,source,description,amount_cents,
      appointment_id,client_id,created_by
    ) values(
      p_workspace_id,
      'income'::public.financial_entry_type,
      'pending'::public.financial_entry_status,
      'appointment'::public.financial_entry_source,
      'Atendimento concluído',
      v_appt.price_cents,
      v_appt.id,
      v_appt.client_id,
      auth.uid()
    );
  elsif v_fin.status='cancelled'::public.financial_entry_status then
    update public.financial_entries
    set status='pending'::public.financial_entry_status,
        cancelled_at=null,
        paid_at=null,
        payment_method=null
    where id=v_fin.id
      and workspace_id=p_workspace_id;
  end if;

  return jsonb_build_object(
    'redemption_id',v_r.id,
    'client_package_id',v_cp.id,
    'appointment_id',v_appt.id,
    'package_status',v_new_status,
    'remaining_after_reversal',
      v_item.included_quantity-(v_item.used_quantity-1)
  );
end;
$$;

create or replace function public.reverse_package_redemption(
  p_workspace_id uuid,
  p_redemption_id uuid,
  p_reason text
)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select app.reverse_package_redemption(p_workspace_id,p_redemption_id,p_reason);
$$;

revoke all on function app.protect_package_redemption_mutation() from public,anon,authenticated;
revoke all on function app.reverse_package_redemption(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.reverse_package_redemption(uuid,uuid,text) from public,anon;
grant execute on function public.reverse_package_redemption(uuid,uuid,text) to authenticated;

create or replace function app.expire_client_packages()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_count integer;
begin
  perform set_config('app.bypass_entitlement','on',true);

  update public.client_packages
  set status='expired'::public.client_package_status
  where status='active'::public.client_package_status
    and expires_at is not null
    and expires_at <= now();

  get diagnostics v_count=row_count;

  perform set_config('app.bypass_entitlement','off',true);
  return v_count;
end;
$$;

revoke all on function app.expire_client_packages() from public,anon,authenticated;

do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='agende-expire-client-packages'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end $$;

select cron.schedule(
  'agende-expire-client-packages',
  '29 * * * *',
  'select app.expire_client_packages();'
);

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
set search_path=''
as $$
declare
  v_entry public.financial_entries%rowtype;
  v_refunded integer;
  v_refund_id uuid;
  v_total_after integer;
begin
  perform app.assert_finance_manager(p_workspace_id);

  select * into v_entry
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

  if v_entry.source='package_sale'::public.financial_entry_source
     and v_entry.client_package_id is not null
     and exists(
       select 1
       from public.package_redemptions r
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

  if v_refunded + p_amount_cents > v_entry.amount_cents then
    raise exception 'refund_exceeds_paid_amount' using errcode='22023';
  end if;

  insert into public.financial_refunds(
    workspace_id,financial_entry_id,amount_cents,reason,
    payment_method,refunded_at,created_by
  ) values(
    p_workspace_id,v_entry.id,p_amount_cents,btrim(p_reason),
    p_payment_method,coalesce(p_refunded_at,now()),auth.uid()
  )
  returning id into v_refund_id;

  v_total_after := v_refunded+p_amount_cents;

  if v_entry.source='package_sale'::public.financial_entry_source
     and v_entry.client_package_id is not null
     and v_total_after=v_entry.amount_cents then
    update public.client_packages
    set status='cancelled'::public.client_package_status
    where id=v_entry.client_package_id
      and workspace_id=p_workspace_id
      and status <> 'cancelled'::public.client_package_status;
  end if;

  return v_refund_id;
end;
$$;
