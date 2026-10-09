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
