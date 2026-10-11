-- Read-only schema checks; no migration/repair/history writes.
-- Run only against the explicitly selected project. Null/false is a release block.
select to_regclass('public.appointment_reviews') as reviews_table,
  to_regprocedure('public.submit_appointment_review(uuid,integer,text)') as review_rpc,
  to_regprocedure('public.list_my_reschedule_slots(uuid,uuid,date)') as slots_rpc,
  to_regprocedure('public.save_service_with_professionals(uuid,uuid,text,text,integer,integer,boolean,uuid[])') as service_rpc;

select n.nspname as schema, c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as force_rls
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' order by c.relname;

select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where tablename='appointment_reviews' order by policyname;

select routine_schema,routine_name,grantee,privilege_type
from information_schema.routine_privileges
where routine_schema in ('public','app') and routine_name in
  ('submit_appointment_review','list_my_reschedule_slots','save_service_with_professionals')
order by routine_schema,routine_name,grantee;

select t.tgname,pg_get_triggerdef(t.oid) as definition
from pg_trigger t where t.tgrelid='public.workspace_members'::regclass
and not t.tgisinternal order by t.tgname;

select version,name,cardinality(statements) as statement_count
from supabase_migrations.schema_migrations order by version;
