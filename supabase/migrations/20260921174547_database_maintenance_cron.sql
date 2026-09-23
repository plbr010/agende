
create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

create or replace function app.expire_stale_trials()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform set_config('app.bypass_protected_columns','on',true);

  update public.subscriptions
  set status='expired'::public.subscription_status,
      current_period_end=coalesce(current_period_end,trial_ends_at),
      updated_at=now()
  where status='trialing'::public.subscription_status
    and trial_ends_at is not null
    and trial_ends_at <= now();

  get diagnostics v_count = row_count;

  perform set_config('app.bypass_protected_columns','off',true);
  return v_count;
end;
$$;

create or replace function app.cleanup_public_booking_rate_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.public_booking_rate_events
  where created_at < now() - interval '2 days';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function app.expire_stale_trials() from public, anon, authenticated;
revoke all on function app.cleanup_public_booking_rate_events() from public, anon, authenticated;

do $$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid
  from cron.job
  where jobname='agende-expire-stale-trials'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;

  select jobid into v_jobid
  from cron.job
  where jobname='agende-cleanup-public-booking-rate-events'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end $$;

select cron.schedule(
  'agende-expire-stale-trials',
  '17 * * * *',
  'select app.expire_stale_trials();'
);

select cron.schedule(
  'agende-cleanup-public-booking-rate-events',
  '41 3 * * *',
  'select app.cleanup_public_booking_rate_events();'
);
