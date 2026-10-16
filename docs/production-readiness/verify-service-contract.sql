-- Read-only catalogue checks before/after the individually authorized rollout.
-- Do not call the business RPC here. Full definitions must be reviewed for drift.
SELECT n.nspname AS schema, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS result, p.prosecdef, p.proconfig,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('app','public') AND p.proname IN
 ('save_service_with_professionals','require_workspace_manager','lock_workspace_membership')
ORDER BY p.proname,n.nspname;

SELECT version,name FROM supabase_migrations.schema_migrations
WHERE version='20261010232248' OR name='atomic_service_professional_links';

SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
 ('services','professional_services','professional_profiles','workspace_members');

SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
WHERE conrelid='public.professional_services'::regclass AND contype IN ('u','f');

SELECT c.relname,t.tgname,t.tgenabled FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('services','professional_services') AND NOT t.tgisinternal;
