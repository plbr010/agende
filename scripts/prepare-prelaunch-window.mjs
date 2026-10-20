// Pure local preparation. Does not connect to or modify any database.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root='docs/production-readiness/';
const files=['20261015054116_workspace_media_and_settings_contract.sql','20261015054818_workspace_settings_validation.sql','20261016075244_profiles_booking_whatsapp.sql','20261016235000_require_confirmed_public_booking.sql','20261020162935_launch_discovery_eligibility.sql'];
const rows=files.map(file=>{const source=readFileSync('supabase/migrations/'+file,'utf8').replaceAll('\r\n','\n');return {file,version:file.slice(0,14),name:file.slice(15,-4),sha256:createHash('sha256').update(source).digest('hex'),source};});
const names=rows.map(x=>`'${x.name}'`).join(',');
const versions=rows.map(x=>`'${x.version}'`).join(',');
const preflight=`-- PREPARED ONLY. NO DATABASE OPERATION IS PERFORMED BY THE GENERATOR.
-- Verify actual TLS connection/project externally; this GUC is intent, not identity.
-- Future psql: -X --set=ON_ERROR_STOP=1 --single-transaction --file=THIS_FILE
-- Requires session option: -c agende.authorized_project=wohimauqgywshbbejjcl
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SET LOCAL idle_in_transaction_session_timeout='60s';
DO $prelaunch_guard$
BEGIN
 IF current_setting('agende.authorized_project',true) IS DISTINCT FROM 'wohimauqgywshbbejjcl' THEN RAISE EXCEPTION 'explicit_project_authorization_required'; END IF;
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN (${versions}) OR name IN (${names})) THEN RAISE EXCEPTION 'prelaunch_history_present_or_drift'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND (table_name='workspace_settings' AND column_name='cover_path' OR table_name='professional_profiles' AND column_name='photo_path'))
 OR to_regclass('app.workspace_image_cleanup') IS NOT NULL OR to_regclass('app.professional_photo_cleanup') IS NOT NULL
 OR EXISTS(SELECT 1 FROM storage.buckets WHERE id='professional-photos')
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('get_appointment_whatsapp','swap_workspace_image','swap_professional_photo','get_related_client_avatar','get_public_workspace_cover')) THEN RAISE EXCEPTION 'prelaunch_objects_present_or_drift'; END IF;
 IF to_regprocedure('app.require_confirmed_email()') IS NULL OR to_regprocedure('app.require_workspace_manager(uuid)') IS NULL OR to_regprocedure('app.can_write_appointment(uuid,uuid)') IS NULL OR to_regclass('public.workspace_settings_discovery_city') IS NULL THEN RAISE EXCEPTION 'prelaunch_dependency_missing'; END IF;
 IF to_regclass('public.appointment_reviews') IS NULL OR to_regprocedure('public.list_my_reschedule_slots(uuid,uuid,date)') IS NULL
 OR NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' AND p.proname='sync_billing_subscription' AND p.prosrc LIKE '%v_effective_status%') THEN RAISE EXCEPTION 'prelaunch_legacy_contracts_required'; END IF;
END;
$prelaunch_guard$;
`;
let body=preflight;
for(const row of rows){const delimiter='$source_'+row.version+'$';if(row.source.includes(delimiter))throw new Error('source_delimiter_collision');body+=`\n-- Source ${row.file}; SHA256 ${row.sha256}\n`+row.source+`\n;\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('${row.version}','${row.name}',ARRAY[${delimiter}${row.source}${delimiter}]);\n`;}
body+=`
-- Keep creation paused after migrations restore their normal grants.
-- Separate authorization is required to run the reviewed resume script.
REVOKE EXECUTE ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text) FROM PUBLIC,anon,authenticated;
REVOKE INSERT ON public.appointments FROM PUBLIC,anon,authenticated;
DO $prelaunch_post$
BEGIN
 IF has_function_privilege('anon','public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE')
 OR has_function_privilege('authenticated','public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)','EXECUTE')
 OR has_function_privilege('authenticated','public.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text)','EXECUTE') THEN RAISE EXCEPTION 'prelaunch_pause_grants_failed'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app' AND p.proname='create_public_appointment' AND p.prosrc LIKE '%v_uid := NULL%') THEN RAISE EXCEPTION 'prelaunch_guest_fallback_remains'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='professional-photos' AND NOT public) THEN RAISE EXCEPTION 'prelaunch_private_bucket_failed'; END IF;
END;
$prelaunch_post$;
NOTIFY pgrst, 'reload schema';
`;
writeFileSync(root+'prelaunch20-apply-five.sql',body);
writeFileSync(root+'prelaunch20-migration-manifest.json',JSON.stringify({prepared_only:true,project:'wohimauqgywshbbejjcl',hash_normalization:'UTF-8 LF for sources and bundle',transaction:'psql --single-transaction; errors stop; no nested BEGIN/COMMIT',leaves_bookings_paused:true,history:'exactly five new names/versions and reviewed source; stop on name/version/object collision',bundle_sha256:createHash('sha256').update(body).digest('hex'),migrations:rows.map(({source,...metadata})=>metadata)},null,2)+'\n');
console.log('Prepared reviewed SQL and hashes locally; no database connection');
