-- READ ONLY. Run only against the explicitly selected production project after review.
BEGIN TRANSACTION READ ONLY;
SELECT current_setting('server_version') AS postgres_version;
SELECT required.name, to_regclass(required.name) IS NOT NULL AS present
FROM (VALUES ('public.profiles'),('public.client_profiles'),('public.workspaces'),
 ('public.workspace_settings'),('public.workspace_clients'),('storage.objects'),('storage.buckets')) required(name);
SELECT required.signature, to_regprocedure(required.signature) IS NOT NULL AS present
FROM (VALUES ('app.require_confirmed_email()'),('app.workspace_has_entitlement(uuid)'),
 ('app.is_valid_br_national(text)'),('app.normalize_phone(text)')) required(signature);
SELECT table_name,column_name,data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('profiles','workspace_settings','workspace_clients')
ORDER BY table_name,ordinal_position;
SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','app') AND c.relkind='r' ORDER BY 1,2;
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE tablename IN ('profiles','workspace_clients','objects');
SELECT has_table_privilege('authenticated','public.profiles','UPDATE') AS broad_profile_update;
SELECT to_regclass('public.client_workspace_favorites') AS favorites,
 to_regclass('app.avatar_cleanup_queue') AS cleanup_queue;
SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version;
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='account-avatars';
SELECT count(*) AS profiles_count FROM public.profiles;
SELECT count(*) AS clients_count FROM public.workspace_clients;
SELECT count(*) AS appointments_count FROM public.appointments;
SELECT count(*) AS reviews_count FROM public.appointment_reviews;
ROLLBACK;
