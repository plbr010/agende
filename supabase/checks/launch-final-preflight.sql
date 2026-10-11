-- READ ONLY. Inspect results before approving the four pending migrations.
-- This file neither writes application data nor repairs migration history.
select version,name,cardinality(statements) statement_count
from supabase_migrations.schema_migrations order by version;

select to_regclass('public.appointment_reviews') reviews_table,
       to_regprocedure('public.submit_appointment_review(uuid,integer,text)') review_rpc,
       to_regprocedure('public.list_my_reschedule_slots(uuid,uuid,date)') reschedule_rpc;

select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','app') and c.relkind='r' order by 1,2;

select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','app') and p.prosecdef
  and not coalesce('search_path=""'=any(p.proconfig),false);

select pg_get_triggerdef(oid) owner_guard
from pg_trigger where tgrelid='public.workspace_members'::regclass
  and tgname='workspace_members_keep_owner';

-- Old observed implementation: ef99daf53b01ff7d7388c28ca2ec2aa6.
-- Reviewed implementation after rollout: 01ee8d8dce2e38b4713a35ffafa5f026.
-- Any other fingerprint requires a new comparison/review, not replacement.
select md5(replace(pg_get_functiondef(
  'app.sync_billing_subscription(uuid,text,text,text,public.subscription_plan,public.billing_interval,public.subscription_status,timestamptz,timestamptz,timestamptz)'::regprocedure
),chr(13),'')) billing_sync_fingerprint;

select table_schema,table_name,grantee,privilege_type
from information_schema.role_table_grants
where table_schema in ('public','app') and grantee in ('anon','authenticated')
order by 1,2,3,4;
