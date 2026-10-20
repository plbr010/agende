-- PREPARED ONLY; separate authorization from the five-media/auth migrations.
-- psql -X --set=ON_ERROR_STOP=1 --single-transaction --file=THIS_FILE
-- Verify actual TLS/project externally; GUC records intent, not server identity.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SET LOCAL idle_in_transaction_session_timeout='60s';
DO $legacy_preflight$
BEGIN
 IF current_setting('agende.authorized_project',true) IS DISTINCT FROM 'wohimauqgywshbbejjcl' THEN RAISE EXCEPTION 'explicit_project_authorization_required'; END IF;
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN ('20260927014947','20261008131859','20261009173042') OR name IN ('launch_readiness_reviews','launch_hardening_reviews_force_rls','billing_reconcile_excess_seats')) THEN RAISE EXCEPTION 'prelaunch_legacy_history_present_or_drift'; END IF;
 IF to_regclass('public.appointment_reviews') IS NOT NULL OR to_regprocedure('public.list_my_reschedule_slots(uuid,uuid,date)') IS NOT NULL OR to_regprocedure('public.submit_appointment_review(uuid,integer,text)') IS NOT NULL THEN RAISE EXCEPTION 'prelaunch_legacy_objects_present_or_drift'; END IF;
END;
$legacy_preflight$;

-- 20260927014947_launch_readiness_reviews.sql; SHA256 952a8f9e2e93c74bab851f9c8fa7c0a3abeeb568beedbccb4545f9407e5b1253
-- Additive launch readiness: immutable appointment reviews and client read model.
-- No history repair, no billing changes; apply only after review.
create table public.appointment_reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id),
  workspace_id uuid not null references public.workspaces(id),
  client_user_id uuid not null references auth.users(id),
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index appointment_reviews_workspace_idx on public.appointment_reviews(workspace_id, created_at desc);
create index appointment_reviews_client_idx on public.appointment_reviews(client_user_id);
alter table public.appointment_reviews enable row level security;
revoke all on public.appointment_reviews from public, anon, authenticated;
grant select on public.appointment_reviews to authenticated;
grant all on public.appointment_reviews to service_role;
create policy appointment_reviews_read on public.appointment_reviews for select to authenticated
using (client_user_id = (select auth.uid()) or (select app.is_workspace_member(workspace_id)));

create function public.submit_appointment_review(p_appointment_id uuid, p_rating integer, p_comment text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_appointment public.appointments%rowtype;
  v_review public.appointment_reviews%rowtype;
begin
  v_uid := app.require_confirmed_email();
  perform app.link_workspace_clients_by_confirmed_email();
  select a.* into v_appointment from public.appointments a
  join public.workspace_clients c on c.id=a.client_id and c.workspace_id=a.workspace_id
  where a.id=p_appointment_id and c.linked_user_id=v_uid for update of a;
  if v_appointment.id is null then raise exception 'appointment_not_found' using errcode='42501'; end if;
  if v_appointment.status <> 'completed' then raise exception 'appointment_not_completed' using errcode='22023'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'invalid_rating' using errcode='22023'; end if;
  if char_length(btrim(p_comment)) > 500 then raise exception 'review_comment_too_long' using errcode='22023'; end if;
  insert into public.appointment_reviews(appointment_id,workspace_id,client_user_id,rating,comment)
  values(v_appointment.id,v_appointment.workspace_id,v_uid,p_rating,nullif(btrim(p_comment),''))
  on conflict (appointment_id) do nothing returning * into v_review;
  if v_review.id is null then raise exception 'appointment_already_reviewed' using errcode='23505'; end if;
  return jsonb_build_object('appointment_id',v_review.appointment_id,'rating',v_review.rating,'comment',v_review.comment,'created_at',v_review.created_at);
end;
$$;
revoke all on function public.submit_appointment_review(uuid,integer,text) from public,anon;
grant execute on function public.submit_appointment_review(uuid,integer,text) to authenticated;
comment on table public.appointment_reviews is 'One immutable review per completed appointment. Clients cannot edit or delete. No anonymous/public exposure.';


CREATE OR REPLACE FUNCTION app.list_my_appointments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := app.require_confirmed_email();
  PERFORM app.link_workspace_clients_by_confirmed_email();

  RETURN COALESCE((
    SELECT jsonb_agg(row_data ORDER BY (row_data->>'starts_at'))
    FROM (
      SELECT jsonb_build_object(
        'id', a.id,
        'service_id', a.service_id,
        'professional_member_id', a.professional_member_id,
        'workspace_name', w.name,
        'slug', w.slug,
        'service_name', s.name,
        'professional_name', p.display_name,
        'starts_at', a.starts_at,
        'ends_at', a.ends_at,
        'duration_minutes', a.duration_minutes,
        'price_cents', a.price_cents,
        'status', a.status,
        'timezone', app.workspace_timezone(a.workspace_id),
        'customer_note', a.customer_note,
        'business_phone', st.business_phone
      ) AS row_data
      FROM public.appointments a
      JOIN public.workspace_clients c ON c.id = a.client_id AND c.workspace_id = a.workspace_id
      JOIN public.workspaces w ON w.id = a.workspace_id
      JOIN public.services s ON s.id = a.service_id
      JOIN public.professional_profiles p ON p.member_id = a.professional_member_id
      LEFT JOIN public.workspace_settings st ON st.workspace_id = a.workspace_id
      WHERE c.linked_user_id = v_uid
    ) listed
  ), '[]'::jsonb);
END;
$$;


-- Availability for rescheduling uses the appointment's preserved duration and
-- excludes the appointment itself. Current catalog durations may have changed.
create function public.list_my_reschedule_slots(p_appointment_id uuid, p_professional_member_id uuid, p_local_date date)
returns table(starts_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid;
  v_a public.appointments%rowtype;
  v_tz text;
  v_slot timestamptz;
begin
  v_uid := app.require_confirmed_email();
  perform app.link_workspace_clients_by_confirmed_email();
  select a.* into v_a from public.appointments a join public.workspace_clients c
    on c.id=a.client_id and c.workspace_id=a.workspace_id
    where a.id=p_appointment_id and c.linked_user_id=v_uid;
  if v_a.id is null then raise exception 'appointment_not_found' using errcode='42501'; end if;
  perform app.assert_workspace_entitled(v_a.workspace_id);
  if v_a.status not in ('scheduled','confirmed') then raise exception 'appointment_not_reschedulable' using errcode='22023'; end if;
  if v_a.starts_at < clock_timestamp()+make_interval(mins=>app.client_cancel_lead_minutes()) then raise exception 'reschedule_too_late' using errcode='22023'; end if;
  perform 1 from app.resolve_service_snapshot(v_a.workspace_id,p_professional_member_id,v_a.service_id);
  v_tz := app.workspace_timezone(v_a.workspace_id);
  if p_local_date is null then raise exception 'invalid_date' using errcode='22023'; end if;
  for v_slot in select (p_local_date::timestamp + make_interval(mins=>n)) at time zone v_tz from generate_series(0,1425,15) n loop
    begin
      perform app.assert_public_booking_window(v_a.workspace_id,v_slot);
      perform app.assert_slot_available(v_a.workspace_id,p_professional_member_id,v_slot,v_slot+make_interval(mins=>v_a.duration_minutes),v_a.id);
      starts_at := v_slot;
      return next;
    exception when sqlstate '22023' or sqlstate '23P01' then
      -- Expected closed windows, occupied slots and cutoffs; all other errors propagate.
      null;
    end;
  end loop;
end;
$$;
revoke all on function public.list_my_reschedule_slots(uuid,uuid,date) from public,anon;
grant execute on function public.list_my_reschedule_slots(uuid,uuid,date) to authenticated;


;
INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20260927014947','launch_readiness_reviews',ARRAY[$legacy_20260927014947$-- Additive launch readiness: immutable appointment reviews and client read model.
-- No history repair, no billing changes; apply only after review.
create table public.appointment_reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id),
  workspace_id uuid not null references public.workspaces(id),
  client_user_id uuid not null references auth.users(id),
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index appointment_reviews_workspace_idx on public.appointment_reviews(workspace_id, created_at desc);
create index appointment_reviews_client_idx on public.appointment_reviews(client_user_id);
alter table public.appointment_reviews enable row level security;
revoke all on public.appointment_reviews from public, anon, authenticated;
grant select on public.appointment_reviews to authenticated;
grant all on public.appointment_reviews to service_role;
create policy appointment_reviews_read on public.appointment_reviews for select to authenticated
using (client_user_id = (select auth.uid()) or (select app.is_workspace_member(workspace_id)));

create function public.submit_appointment_review(p_appointment_id uuid, p_rating integer, p_comment text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_appointment public.appointments%rowtype;
  v_review public.appointment_reviews%rowtype;
begin
  v_uid := app.require_confirmed_email();
  perform app.link_workspace_clients_by_confirmed_email();
  select a.* into v_appointment from public.appointments a
  join public.workspace_clients c on c.id=a.client_id and c.workspace_id=a.workspace_id
  where a.id=p_appointment_id and c.linked_user_id=v_uid for update of a;
  if v_appointment.id is null then raise exception 'appointment_not_found' using errcode='42501'; end if;
  if v_appointment.status <> 'completed' then raise exception 'appointment_not_completed' using errcode='22023'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'invalid_rating' using errcode='22023'; end if;
  if char_length(btrim(p_comment)) > 500 then raise exception 'review_comment_too_long' using errcode='22023'; end if;
  insert into public.appointment_reviews(appointment_id,workspace_id,client_user_id,rating,comment)
  values(v_appointment.id,v_appointment.workspace_id,v_uid,p_rating,nullif(btrim(p_comment),''))
  on conflict (appointment_id) do nothing returning * into v_review;
  if v_review.id is null then raise exception 'appointment_already_reviewed' using errcode='23505'; end if;
  return jsonb_build_object('appointment_id',v_review.appointment_id,'rating',v_review.rating,'comment',v_review.comment,'created_at',v_review.created_at);
end;
$$;
revoke all on function public.submit_appointment_review(uuid,integer,text) from public,anon;
grant execute on function public.submit_appointment_review(uuid,integer,text) to authenticated;
comment on table public.appointment_reviews is 'One immutable review per completed appointment. Clients cannot edit or delete. No anonymous/public exposure.';


CREATE OR REPLACE FUNCTION app.list_my_appointments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := app.require_confirmed_email();
  PERFORM app.link_workspace_clients_by_confirmed_email();

  RETURN COALESCE((
    SELECT jsonb_agg(row_data ORDER BY (row_data->>'starts_at'))
    FROM (
      SELECT jsonb_build_object(
        'id', a.id,
        'service_id', a.service_id,
        'professional_member_id', a.professional_member_id,
        'workspace_name', w.name,
        'slug', w.slug,
        'service_name', s.name,
        'professional_name', p.display_name,
        'starts_at', a.starts_at,
        'ends_at', a.ends_at,
        'duration_minutes', a.duration_minutes,
        'price_cents', a.price_cents,
        'status', a.status,
        'timezone', app.workspace_timezone(a.workspace_id),
        'customer_note', a.customer_note,
        'business_phone', st.business_phone
      ) AS row_data
      FROM public.appointments a
      JOIN public.workspace_clients c ON c.id = a.client_id AND c.workspace_id = a.workspace_id
      JOIN public.workspaces w ON w.id = a.workspace_id
      JOIN public.services s ON s.id = a.service_id
      JOIN public.professional_profiles p ON p.member_id = a.professional_member_id
      LEFT JOIN public.workspace_settings st ON st.workspace_id = a.workspace_id
      WHERE c.linked_user_id = v_uid
    ) listed
  ), '[]'::jsonb);
END;
$$;


-- Availability for rescheduling uses the appointment's preserved duration and
-- excludes the appointment itself. Current catalog durations may have changed.
create function public.list_my_reschedule_slots(p_appointment_id uuid, p_professional_member_id uuid, p_local_date date)
returns table(starts_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid;
  v_a public.appointments%rowtype;
  v_tz text;
  v_slot timestamptz;
begin
  v_uid := app.require_confirmed_email();
  perform app.link_workspace_clients_by_confirmed_email();
  select a.* into v_a from public.appointments a join public.workspace_clients c
    on c.id=a.client_id and c.workspace_id=a.workspace_id
    where a.id=p_appointment_id and c.linked_user_id=v_uid;
  if v_a.id is null then raise exception 'appointment_not_found' using errcode='42501'; end if;
  perform app.assert_workspace_entitled(v_a.workspace_id);
  if v_a.status not in ('scheduled','confirmed') then raise exception 'appointment_not_reschedulable' using errcode='22023'; end if;
  if v_a.starts_at < clock_timestamp()+make_interval(mins=>app.client_cancel_lead_minutes()) then raise exception 'reschedule_too_late' using errcode='22023'; end if;
  perform 1 from app.resolve_service_snapshot(v_a.workspace_id,p_professional_member_id,v_a.service_id);
  v_tz := app.workspace_timezone(v_a.workspace_id);
  if p_local_date is null then raise exception 'invalid_date' using errcode='22023'; end if;
  for v_slot in select (p_local_date::timestamp + make_interval(mins=>n)) at time zone v_tz from generate_series(0,1425,15) n loop
    begin
      perform app.assert_public_booking_window(v_a.workspace_id,v_slot);
      perform app.assert_slot_available(v_a.workspace_id,p_professional_member_id,v_slot,v_slot+make_interval(mins=>v_a.duration_minutes),v_a.id);
      starts_at := v_slot;
      return next;
    exception when sqlstate '22023' or sqlstate '23P01' then
      -- Expected closed windows, occupied slots and cutoffs; all other errors propagate.
      null;
    end;
  end loop;
end;
$$;
revoke all on function public.list_my_reschedule_slots(uuid,uuid,date) from public,anon;
grant execute on function public.list_my_reschedule_slots(uuid,uuid,date) to authenticated;

$legacy_20260927014947$]);

-- 20261008131859_launch_hardening_reviews_force_rls.sql; SHA256 39b4f8617d80ff0aa10619c684d0565fe75e3f6ad7f431440d7aded474408848
-- Additive launch hardening. Do not apply to production until the dry-run
-- documented in docs/migrations/launch-readiness-2026-10-08.md has been reviewed.
-- Depends on 20260927014947_launch_readiness_reviews (creates appointment_reviews).
-- Does not reconstruct the empty remote-only version 20260919201138.

alter table public.appointment_reviews force row level security;

comment on function public.submit_appointment_review(uuid, integer, text) is
  'SECURITY DEFINER: a confirmed client inserts one immutable review of their own completed appointment. Empty search_path. No INSERT policy on the table.';

comment on function public.list_my_reschedule_slots(uuid, uuid, date) is
  'SECURITY DEFINER: a confirmed client lists slots for their own reschedulable appointment. IDOR is blocked via linked_user_id.';

-- Safety net for advisor noise and search_path hijack: every SECURITY DEFINER
-- function in app/public must pin an empty search_path. Bodies are unchanged.
do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and n.nspname in ('app', 'public')
      and (
        p.proconfig is null
        or not exists (
          select 1
          from unnest(p.proconfig) as cfg(value)
          where cfg.value like 'search_path=%'
        )
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = %L',
      r.schema_name,
      r.function_name,
      r.args,
      ''
    );
  end loop;
end;
$$;

;
INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261008131859','launch_hardening_reviews_force_rls',ARRAY[$legacy_20261008131859$-- Additive launch hardening. Do not apply to production until the dry-run
-- documented in docs/migrations/launch-readiness-2026-10-08.md has been reviewed.
-- Depends on 20260927014947_launch_readiness_reviews (creates appointment_reviews).
-- Does not reconstruct the empty remote-only version 20260919201138.

alter table public.appointment_reviews force row level security;

comment on function public.submit_appointment_review(uuid, integer, text) is
  'SECURITY DEFINER: a confirmed client inserts one immutable review of their own completed appointment. Empty search_path. No INSERT policy on the table.';

comment on function public.list_my_reschedule_slots(uuid, uuid, date) is
  'SECURITY DEFINER: a confirmed client lists slots for their own reschedulable appointment. IDOR is blocked via linked_user_id.';

-- Safety net for advisor noise and search_path hijack: every SECURITY DEFINER
-- function in app/public must pin an empty search_path. Bodies are unchanged.
do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name,
           p.proname as function_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and n.nspname in ('app', 'public')
      and (
        p.proconfig is null
        or not exists (
          select 1
          from unnest(p.proconfig) as cfg(value)
          where cfg.value like 'search_path=%'
        )
      )
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = %L',
      r.schema_name,
      r.function_name,
      r.args,
      ''
    );
  end loop;
end;
$$;
$legacy_20261008131859$]);

-- 20261009173042_billing_reconcile_excess_seats.sql; SHA256 f5ef371d3bb3f2a9f33d940d78ba94106e88da1a0306fe9fa48d9e767b02c7ab
-- Additive billing correction; explicit approval required before production rollout.
-- Keeps all membership rows, trial dates, bindings and existing RPC grants.
DO $preflight$
BEGIN
  PERFORM pg_catalog.set_config('search_path','pg_catalog,public',true);
  IF md5(replace(pg_get_functiondef('app.sync_billing_subscription(uuid,text,text,text,public.subscription_plan,public.billing_interval,public.subscription_status,timestamptz,timestamptz,timestamptz)'::regprocedure),chr(13),''))
     NOT IN ('ef99daf53b01ff7d7388c28ca2ec2aa6', '01ee8d8dce2e38b4713a35ffafa5f026') THEN
    RAISE EXCEPTION 'unexpected_definition: app.sync_billing_subscription';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION app.sync_billing_subscription(p_workspace_id uuid, p_provider text, p_external_customer_id text, p_external_subscription_id text, p_plan subscription_plan, p_billing_interval billing_interval, p_status subscription_status, p_current_period_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_current_period_end timestamp with time zone DEFAULT NULL::timestamp with time zone, p_canceled_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_subscription public.subscriptions%rowtype;
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_customer_id text := btrim(coalesce(p_external_customer_id, ''));
  v_subscription_id text := btrim(coalesce(p_external_subscription_id, ''));
  v_canceled_at timestamptz;
  v_max_professionals integer;
  v_used_professionals integer;
  v_effective_status public.subscription_status := p_status;
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

  if p_status in (
       'active'::public.subscription_status,
       'past_due'::public.subscription_status
     )
     and (p_current_period_start is null or p_current_period_end is null) then
    raise exception 'billing_period_required' using errcode = '22023';
  end if;

  select p.max_professionals
    into v_max_professionals
  from public.plans p
  where p.code = p_plan;

  if v_max_professionals is null then
    raise exception 'plan_not_found' using errcode = '22023';
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
      and s.billing_provider = v_provider
      and (
        s.external_customer_id = v_customer_id
        or s.external_subscription_id = v_subscription_id
      )
  ) then
    raise exception 'external_billing_identity_already_bound' using errcode = '23505';
  end if;

  -- Count seats only after the subscription lock also used by membership writes.
  -- Record terminal/delinquent states regardless of seats. An incompatible paid
  -- downgrade must fail closed rather than retain the previous active entitlement.
  v_used_professionals := app.workspace_professional_seats(p_workspace_id);
  if v_used_professionals > v_max_professionals
     and p_status in ('active'::public.subscription_status, 'trialing'::public.subscription_status) then
    v_effective_status := 'expired'::public.subscription_status;
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
      status = v_effective_status,
      billing_interval = p_billing_interval,
      billing_provider = v_provider,
      external_customer_id = v_customer_id,
      external_subscription_id = v_subscription_id,
      current_period_start = p_current_period_start,
      current_period_end = p_current_period_end,
      canceled_at = v_canceled_at
  where workspace_id = p_workspace_id;
end;
$function$


;
INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261009173042','billing_reconcile_excess_seats',ARRAY[$legacy_20261009173042$-- Additive billing correction; explicit approval required before production rollout.
-- Keeps all membership rows, trial dates, bindings and existing RPC grants.
DO $preflight$
BEGIN
  PERFORM pg_catalog.set_config('search_path','pg_catalog,public',true);
  IF md5(replace(pg_get_functiondef('app.sync_billing_subscription(uuid,text,text,text,public.subscription_plan,public.billing_interval,public.subscription_status,timestamptz,timestamptz,timestamptz)'::regprocedure),chr(13),''))
     NOT IN ('ef99daf53b01ff7d7388c28ca2ec2aa6', '01ee8d8dce2e38b4713a35ffafa5f026') THEN
    RAISE EXCEPTION 'unexpected_definition: app.sync_billing_subscription';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION app.sync_billing_subscription(p_workspace_id uuid, p_provider text, p_external_customer_id text, p_external_subscription_id text, p_plan subscription_plan, p_billing_interval billing_interval, p_status subscription_status, p_current_period_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_current_period_end timestamp with time zone DEFAULT NULL::timestamp with time zone, p_canceled_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_subscription public.subscriptions%rowtype;
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_customer_id text := btrim(coalesce(p_external_customer_id, ''));
  v_subscription_id text := btrim(coalesce(p_external_subscription_id, ''));
  v_canceled_at timestamptz;
  v_max_professionals integer;
  v_used_professionals integer;
  v_effective_status public.subscription_status := p_status;
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

  if p_status in (
       'active'::public.subscription_status,
       'past_due'::public.subscription_status
     )
     and (p_current_period_start is null or p_current_period_end is null) then
    raise exception 'billing_period_required' using errcode = '22023';
  end if;

  select p.max_professionals
    into v_max_professionals
  from public.plans p
  where p.code = p_plan;

  if v_max_professionals is null then
    raise exception 'plan_not_found' using errcode = '22023';
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
      and s.billing_provider = v_provider
      and (
        s.external_customer_id = v_customer_id
        or s.external_subscription_id = v_subscription_id
      )
  ) then
    raise exception 'external_billing_identity_already_bound' using errcode = '23505';
  end if;

  -- Count seats only after the subscription lock also used by membership writes.
  -- Record terminal/delinquent states regardless of seats. An incompatible paid
  -- downgrade must fail closed rather than retain the previous active entitlement.
  v_used_professionals := app.workspace_professional_seats(p_workspace_id);
  if v_used_professionals > v_max_professionals
     and p_status in ('active'::public.subscription_status, 'trialing'::public.subscription_status) then
    v_effective_status := 'expired'::public.subscription_status;
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
      status = v_effective_status,
      billing_interval = p_billing_interval,
      billing_provider = v_provider,
      external_customer_id = v_customer_id,
      external_subscription_id = v_subscription_id,
      current_period_start = p_current_period_start,
      current_period_end = p_current_period_end,
      canceled_at = v_canceled_at
  where workspace_id = p_workspace_id;
end;
$function$

$legacy_20261009173042$]);

-- Preserve the authorized maintenance boundary.
REVOKE EXECUTE ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text) FROM PUBLIC,anon,authenticated;
REVOKE INSERT ON public.appointments FROM PUBLIC,anon,authenticated;
DO $legacy_post$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='public.appointment_reviews'::regclass AND relrowsecurity AND relforcerowsecurity)
 OR NOT has_function_privilege('authenticated','public.list_my_reschedule_slots(uuid,uuid,date)','EXECUTE')
 OR has_function_privilege('anon','public.submit_appointment_review(uuid,integer,text)','EXECUTE') THEN RAISE EXCEPTION 'prelaunch_legacy_contract_failed'; END IF;
END;
$legacy_post$;
NOTIFY pgrst,'reload schema';
