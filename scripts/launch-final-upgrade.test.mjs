import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

test('final pending set upgrades populated legacy SQL atomically and rolls back on failure', async t => {
  const db = await createLocalDatabase({ throughVersion: '20261020162935' });
  t.after(() => db.close());
  await db.exec(readFileSync('supabase/tests/helpers.sql', 'utf8'));
  const owner=(await db.query("select test_helpers.create_auth_user('final-upgrade@local.invalid','professional',true) id")).rows[0].id;
  const asOwner=(sql,args=[])=>db.transaction(async tx=>{
    await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[owner]);
    await tx.exec('set local role authenticated');return tx.query(sql,args);
  });
  const workspace=(await asOwner("select public.create_workspace('Populated rollback fixture',null,'equipe') r")).rows[0].r.workspace_id;
  const entry=(await asOwner("select public.create_financial_entry($1,'income','Legacy received income',1000,current_date) id",[workspace])).rows[0].id;
  await asOwner("select public.mark_financial_entry_paid($1,$2,'pix')",[workspace,entry]);
  const snapshot=async()=>({
    subscriptions:(await db.query('select * from public.subscriptions order by id')).rows,
    financial:(await db.query("select to_jsonb(f)-ARRAY['linked_settlement_id','commission_payment_id'] data from public.financial_entries f order by id")).rows,
    memberships:(await db.query('select * from public.workspace_members order by id')).rows,
  });
  const before=await snapshot();
  const plan=JSON.parse(readFileSync('docs/production-readiness/launch-final-migration-plan.json','utf8'));
  await db.exec('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text)');
  const catalog=JSON.parse(readFileSync('docs/production-readiness/launch-final-catalog-readonly.json','utf8'));
  // Synthetic ledger shape only. This is not a restore of production or a repair.
  for(const h of catalog.history)await db.query('insert into supabase_migrations.schema_migrations values($1,$2)',[h.version,h.name]);
  const apply=async(tx)=>{
    for(const m of plan.pending){
      await tx.exec(readFileSync('supabase/migrations/'+m.file,'utf8'));
      await tx.query('insert into supabase_migrations.schema_migrations values($1,$2)',[m.version,m.file.slice(15,-4)]);
    }
  };
  await assert.rejects(db.transaction(async tx=>{await apply(tx);await tx.exec("do $$ begin raise exception 'forced_precommit_failure'; end $$");}),/forced_precommit_failure/);
  assert.deepEqual(await snapshot(),before);
  assert.equal((await db.query("select to_regclass('public.financial_receipts') r")).rows[0].r,null);
  assert.equal((await db.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,catalog.history.length);
  await db.transaction(apply);
  assert.deepEqual(await snapshot(),before);
  assert.equal((await db.query('select count(*)::int n from supabase_migrations.schema_migrations')).rows[0].n,catalog.history.length+plan.pending.length);
  assert.deepEqual((await db.query('select amount_cents,payment_method,idempotency_key from public.financial_receipts where financial_entry_id=$1',[entry])).rows,[{amount_cents:1000,payment_method:'pix',idempotency_key:'legacy:'+entry}]);
  assert.equal((await db.query('select globally_paused from app.booking_creation_controls')).rows[0].globally_paused,true);
  assert.equal((await db.query("select has_function_privilege('authenticated','public.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text)','EXECUTE') allowed")).rows[0].allowed,false);
  await assert.rejects(db.transaction(apply), /already exists|duplicate/);
  assert.deepEqual(await snapshot(),before);
});
