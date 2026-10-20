// Pure local preparation of separately reviewed legacy contracts, not history repair.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const files=['20260927014947_launch_readiness_reviews.sql','20261008131859_launch_hardening_reviews_force_rls.sql','20261009173042_billing_reconcile_excess_seats.sql'];
const rows=files.map(file=>{const source=readFileSync('supabase/migrations/'+file,'utf8').replaceAll('\r\n','\n');return{file,version:file.slice(0,14),name:file.slice(15,-4),source,sha256:createHash('sha256').update(source).digest('hex')};});
const versions=rows.map(x=>`'${x.version}'`).join(','),names=rows.map(x=>`'${x.name}'`).join(',');
let body=`-- PREPARED ONLY; separate authorization from the five-media/auth migrations.
-- psql -X --set=ON_ERROR_STOP=1 --single-transaction --file=THIS_FILE
-- Verify actual TLS/project externally; GUC records intent, not server identity.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SET LOCAL idle_in_transaction_session_timeout='60s';
DO $legacy_preflight$
BEGIN
 IF current_setting('agende.authorized_project',true) IS DISTINCT FROM 'wohimauqgywshbbejjcl' THEN RAISE EXCEPTION 'explicit_project_authorization_required'; END IF;
 IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version IN (${versions}) OR name IN (${names})) THEN RAISE EXCEPTION 'prelaunch_legacy_history_present_or_drift'; END IF;
 IF to_regclass('public.appointment_reviews') IS NOT NULL OR to_regprocedure('public.list_my_reschedule_slots(uuid,uuid,date)') IS NOT NULL OR to_regprocedure('public.submit_appointment_review(uuid,integer,text)') IS NOT NULL THEN RAISE EXCEPTION 'prelaunch_legacy_objects_present_or_drift'; END IF;
END;
$legacy_preflight$;
`;
for(const row of rows){const delimiter='$legacy_'+row.version+'$';if(row.source.includes(delimiter))throw new Error('source_delimiter_collision');body+=`\n-- ${row.file}; SHA256 ${row.sha256}\n`+row.source+`\n;\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('${row.version}','${row.name}',ARRAY[${delimiter}${row.source}${delimiter}]);\n`;}
body+=`
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
`;
const root='docs/production-readiness/';
writeFileSync(root+'prelaunch20-apply-legacy.sql',body);
writeFileSync(root+'prelaunch20-legacy-manifest.json',JSON.stringify({prepared_only:true,separate_authorization_required:true,project:'wohimauqgywshbbejjcl',hash_normalization:'UTF-8 LF',leaves_bookings_paused:true,transaction:'psql --single-transaction; stop on error',excluded_already_equivalent:'20261009172028_launch_observed_owner_guard.sql; no history repair',bundle_sha256:createHash('sha256').update(body).digest('hex'),migrations:rows.map(({source,...metadata})=>metadata)},null,2)+'\n');
console.log('Prepared three legacy contracts locally; no database connection');
