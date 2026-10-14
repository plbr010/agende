// Generates a reviewable transaction. Never connects to any database.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source=readFileSync('supabase/migrations/20261014030220_public_workspace_discovery.sql','utf8');
const hash=createHash('sha256').update(source).digest('hex');
const payload=`-- PREPARED ONLY: requires recoverable backup and specific production approval.
-- psql -X --set=ON_ERROR_STOP=1 --single-transaction --file=THIS_FILE
-- Source SHA256: ${hash}
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SET LOCAL idle_in_transaction_session_timeout='60s';
DO $preflight$
BEGIN
  IF EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261014030220')
    OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='workspace_settings' AND column_name='discovery_enabled')
    OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('app','public') AND p.proname IN ('discovery_text','get_workspace_discovery','set_workspace_discovery','search_public_workspaces','list_public_localities')) THEN
    RAISE EXCEPTION 'discovery_already_present_or_drift';
  END IF;
  IF to_regprocedure('app.require_workspace_manager(uuid)') IS NULL
    OR to_regprocedure('app.lock_workspace_membership(uuid)') IS NULL
    OR to_regprocedure('app.workspace_has_entitlement(uuid)') IS NULL THEN
    RAISE EXCEPTION 'discovery_dependency_missing';
  END IF;
END;
$preflight$;
${source}
DO $verify$
BEGIN
  IF EXISTS(SELECT 1 FROM public.workspace_settings WHERE discovery_enabled) THEN
    RAISE EXCEPTION 'discovery_requires_explicit_consent';
  END IF;
  IF has_function_privilege('anon','public.set_workspace_discovery(uuid,boolean)','execute')
    OR has_function_privilege('anon','app.discovery_text(text)','execute')
    OR NOT has_function_privilege('authenticated','public.set_workspace_discovery(uuid,boolean)','execute')
    OR NOT has_function_privilege('anon','public.search_public_workspaces(text,text,text,text,integer,integer)','execute') THEN
    RAISE EXCEPTION 'discovery_grant_verification_failed';
  END IF;
END;
$verify$;
INSERT INTO supabase_migrations.schema_migrations(version,name,statements)
VALUES('20261014030220','public_workspace_discovery',ARRAY[$source$${source}$source$]);
`;
writeFileSync('docs/production-readiness/apply-discovery-only.sql',payload);
console.log(JSON.stringify({prepared:true,source_sha256:hash,production_connections:0}));
