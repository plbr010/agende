import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

// Offline validation only; never applies the release plan to a remote project.
const plan=JSON.parse(readFileSync('docs/production-readiness/migration-plan.json','utf8'));
assert.equal(plan.approved,false);
for(const migration of plan.migrations){
  const actual=createHash('sha256').update(readFileSync(migration.path)).digest('hex');
  assert.equal(actual,migration.sha256,'Migration changed after plan generation: '+migration.path);
}
const db=await createLocalDatabase();
try{
  // The local SQL harness has no CLI migration-history service. This empty table
  // tests only the history SELECT's syntax, not remote bookkeeping correctness.
  await db.exec('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text,name text,statements text[])');
  const results=await db.exec(readFileSync('docs/production-readiness/validate-schema.sql','utf8'));
  assert.ok(Object.values(results[0].rows[0]).every(Boolean),'Expected table/RPC missing from local target');
  assert.ok(results[1].rows.every(row=>row.rls&&row.force_rls),'Public table without RLS/FORCE');
  assert.ok(results[2].rows.some(row=>row.policyname==='appointment_reviews_read'));
  assert.ok(results[4].rows.some(row=>row.tgname==='workspace_members_keep_owner'));
  console.log(JSON.stringify({release_plan:'PASS',engine:db.native?'native PG17':'PGlite',migration_hashes_checked:plan.migrations.length,history:'empty local fixture; not remote history validation',remote_writes:0}));
}finally{await db.close();}
