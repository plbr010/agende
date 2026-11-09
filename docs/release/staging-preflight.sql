-- READ ONLY. Re-run against the explicitly authorized STAGING project only.
BEGIN READ ONLY;
SELECT current_database(), current_setting('server_version');
SELECT to_regclass('app.platform_admins') IS NOT NULL AS existing_authority,
       to_regclass('app.lifetime_entitlements') IS NOT NULL AS existing_lifetime,
       to_regprocedure('app.official_platform_admin_email()') IS NOT NULL AS identity_helper,
       to_regprocedure('app.admin_write_audit(uuid,text,text,text,jsonb)') IS NOT NULL AS audit_helper,
       to_regprocedure('app.revoke_invalid_platform_admin_identity()') IS NULL AS new_function_absent,
       has_table_privilege(current_user,'auth.users','TRIGGER') AS can_install_auth_trigger;
SELECT n.nspname AS schema,p.proname,pg_get_function_identity_arguments(p.oid) AS args,
       md5(replace(pg_get_functiondef(p.oid),E'\r\n',E'\n')) AS definition_md5_lf,p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname='app' AND p.proname IN ('is_platform_admin','require_platform_admin',
 'enforce_official_platform_admin','workspace_has_entitlement'))
 OR (n.nspname='public' AND p.proname='claim_official_platform_admin')
ORDER BY n.nspname,p.proname;
-- Compare all hashes/ACLs against staging-functions-observed-20261105.json.
-- Stop on drift. Never replay historical migrations to reconcile timestamps.
SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version;
COMMIT;
