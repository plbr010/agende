import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

test('PR84 secure intermediate migrations and explicit legacy reconciliation', async (t) => {
  const db = await createLocalDatabase({throughVersion:'20261023185959'});
  t.after(() => db.close());
  await db.exec(readFileSync('supabase/tests/helpers.sql', 'utf8'));
  let n = 0;
  const user = async (intent = 'professional') => (await db.query(
    'select test_helpers.create_auth_user($1,$2,true) id',
    [`commission-${n++}@agende-local.test`, intent],
  )).rows[0].id;
  const as = (uid, sql, params = []) => db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role','authenticated',true)", [uid]);
    await tx.exec('set local role authenticated');
    return tx.query(sql, params);
  });

  const owner = await user();
  const proUser = await user();
  const bareUser = await user();
  const receptionist = await user();
  const admin = await user();
  const foreignOwner = await user();
  const workspace = (await as(owner, "select public.create_workspace('Salao Comissao', null, 'equipe') result")).rows[0].result.workspace_id;
  await as(foreignOwner, "select public.create_workspace('Outro Salao', null, 'solo') result");
  const ownerMember = (await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2', [workspace, owner])).rows[0].id;
  await db.query("insert into public.workspace_members(workspace_id,user_id,role,status) values ($1,$2,'professional','active'),($1,$3,'professional','active'),($1,$4,'receptionist','active'),($1,$5,'admin','active')", [workspace, proUser, bareUser, receptionist, admin]);
  const memberId = async (uid) => (await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2', [workspace, uid])).rows[0].id;
  const pro = await memberId(proUser);
  const bare = await memberId(bareUser);
  const color = (await as(owner, "insert into public.services(workspace_id,name,duration_minutes,price_cents) values($1,'Corte',60,10000) returning id", [workspace])).rows[0].id;
  const colorExtra = (await as(owner, "insert into public.services(workspace_id,name,duration_minutes,price_cents) values($1,'Escova',60,8000) returning id", [workspace])).rows[0].id;
  for (const member of [ownerMember, pro, bare]) {
    await as(owner, 'insert into public.professional_services(workspace_id,professional_member_id,service_id) values($1,$2,$3),($1,$2,$4)', [workspace, member, color, colorExtra]);
    await as(owner, "insert into public.professional_working_hours(workspace_id,professional_member_id,weekday,start_time,end_time) select $1,$2,n,'08:00','18:00' from generate_series(0,6) n", [workspace, member]);
  }
  const clientUser = await user('client');
  const client = (await db.query("insert into public.workspace_clients(workspace_id,full_name,email) values($1,'Cliente Ficticia',(select email from auth.users where id=$2)) returning id", [workspace, clientUser])).rows[0].id;
  const date = (await db.query("select ((clock_timestamp() at time zone 'America/Sao_Paulo')::date)::text d")).rows[0].d;
  let slot = 0;
  const book = async (member, service = color) => {
    const dayOffset = 4 + Math.floor(slot / 8);
    const start = `${String(8 + (slot % 8)).padStart(2, '0')}:00`;
    slot += 1;
    return (await as(owner, "select public.create_appointment($1,$2,$3,$4,(($5::date + $7::int) + $6::time) at time zone 'America/Sao_Paulo',null) id", [workspace, client, member, service, date, start, dayOffset])).rows[0].id;
  };
  const advance = async (id) => {
    await as(owner, "select public.set_appointment_status($1,'confirmed')", [id]);
    await as(owner, "select public.set_appointment_status($1,'in_progress')", [id]);
  };



  const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&f>'20261023185959').sort();
  // Cloud-like auto grants must not expose newly created objects in any committed step.
  await db.exec('alter default privileges in schema public grant all on tables to authenticated,anon; alter default privileges in schema app grant execute on functions to authenticated,anon;');
  const tables=['commission_rules','appointment_settlements','appointment_settlement_products','financial_receipts','commission_entries','commission_events','commission_payments','workspace_member_permissions'];
  const stages=[];
  await assert.rejects(db.transaction(async tx=>{for(const f of files)await tx.exec(readFileSync('supabase/migrations/'+f,'utf8'));await tx.exec('select 1/0');}),/division by zero/);
  assert.equal((await db.query("select to_regclass('public.commission_entries') n")).rows[0].n,null);
  for(const [index,file]of files.entries()){
    if(index===5)break;
    await db.transaction(tx=>tx.exec(readFileSync('supabase/migrations/'+file,'utf8')));
    const rows=(await db.query("select relname,relrowsecurity,relforcerowsecurity from pg_class where oid=any(select ('public.'||x)::regclass from unnest($1::text[]) x)",[tables])).rows;
    assert.ok(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity));
    for(const name of tables){
      assert.equal((await db.query("select has_table_privilege('authenticated',$1,'INSERT,UPDATE,DELETE') p",['public.'+name])).rows[0].p,false);
      assert.equal((await db.query("select has_table_privilege('anon',$1,'SELECT,INSERT,UPDATE,DELETE') p",['public.'+name])).rows[0].p,false);
    }
    assert.equal((await db.query("select has_function_privilege('authenticated','app.sync_appointment_commission(uuid,text,text,boolean)','execute') p")).rows[0].p,false);
    if(index<2)await assert.rejects(as(foreignOwner,"select app.sync_appointment_commission(gen_random_uuid(),'calculated',null,true)"),/permission denied/);
    if(index===1)assert.equal((await db.query("select has_function_privilege('authenticated','app.complete_appointment_checkout(uuid,text,integer,jsonb,integer,public.payment_method)','execute') p")).rows[0].p,false);
    stages.push({file,rls:true,force_rls:true,untrusted_dml:false,internal_helper_executable:false});
  }
  const fix=readFileSync('supabase/migrations/'+files[5],'utf8');
  for(const received of [500,2001])await assert.rejects(db.transaction(async tx=>{
    const e=(await tx.query("insert into public.financial_entries(workspace_id,entry_type,status,source,description,amount_cents,paid_at,payment_method) values($1,'income','paid','manual','Historical mismatch',2000,now(),'pix') returning id",[workspace])).rows[0].id;
    await tx.query("insert into public.financial_receipts(workspace_id,financial_entry_id,amount_cents,payment_method) values($1,$2,$3,'pix')",[workspace,e,received]);
    if(received===500)await tx.query("insert into public.financial_refunds(workspace_id,financial_entry_id,amount_cents,reason,payment_method,refunded_at) values($1,$2,200,'Historical refund','pix',now())",[workspace,e]);
    await tx.exec(fix);
  }),/paid_receipts_require_reconciliation/);
  const legacyZero=(await as(owner,"select public.create_financial_entry($1,'income','Legacy no receipts',3000,current_date) id",[workspace])).rows[0].id;
  await as(owner,"select public.mark_financial_entry_paid($1,$2,'cash',now()-interval '2 days')",[workspace,legacyZero]);
  const product=(await as(owner,"select public.create_inventory_product($1,'Legacy partial product',p_initial_quantity=>10,p_minimum_quantity=>1,p_cost_cents=>500) p",[workspace])).rows[0].p.id;
  const id=await book(pro);await advance(id);
  const s=(await as(owner,"select public.complete_appointment_checkout($1,'final-upgrade-product',0,$2::jsonb) data",[id,JSON.stringify([{product_id:product,quantity:2,unit_price_cents:1000}])])).rows[0].data;
  const entry=(await db.query('select financial_entry_id id from public.appointment_settlement_products where settlement_id=$1',[s.settlement_id])).rows[0].id;
  await as(owner,"select public.record_financial_receipt($1,$2,500,'cash','final-legacy-partial')",[workspace,entry]);
  await as(owner,"select public.mark_financial_entry_paid($1,$2,'pix')",[workspace,entry]);
  await assert.rejects(db.transaction(tx=>tx.exec(fix)),/paid_receipts_require_reconciliation/);
  assert.equal((await db.query("select count(*)::int n from information_schema.columns where table_name='commission_payments' and column_name='professional_member_id'")).rows[0].n,0);
  assert.equal((await db.query('select sum(amount_cents)::int n from public.financial_receipts where financial_entry_id=$1',[entry])).rows[0].n,500);
  // Simulate an operator's independently verified reconciliation with known synthetic facts.
  // No application code guesses this receipt: it is an explicit fixture for the approved correction.
  await db.query("insert into public.financial_receipts(workspace_id,financial_entry_id,amount_cents,payment_method,received_at,idempotency_key) values($1,$2,1500,'pix',now(),'explicit-reconciled-receipt')",[workspace,entry]);
  await db.transaction(tx=>tx.exec(fix));
  stages.push({file:files[5],rls:true,internal_helper_executable:(await db.query("select has_function_privilege('authenticated','app.lock_financial_parent(uuid,uuid)','execute') p")).rows[0].p});
  assert.equal(stages.at(-1).internal_helper_executable,false);
  assert.equal((await db.query('select sum(amount_cents)::int n from public.financial_receipts where financial_entry_id=$1',[legacyZero])).rows[0].n,3000);
  for(const f of files.slice(6)){
    await db.transaction(tx=>tx.exec(readFileSync('supabase/migrations/'+f,'utf8')));
    const row=(await db.query("select relrowsecurity,relforcerowsecurity,has_table_privilege('authenticated','public.financial_settlement_operations','SELECT,INSERT,UPDATE,DELETE') accessible from pg_class where oid='public.financial_settlement_operations'::regclass")).rows[0];
    assert.ok(row.relrowsecurity&&row.relforcerowsecurity);assert.equal(row.accessible,false);
    assert.equal((await db.query("select has_function_privilege('anon','public.settle_financial_entry(uuid,uuid,public.payment_method,text,timestamptz)','execute') p")).rows[0].p,false);
    stages.push({file:f,rls:true,force_rls:true,operation_ledger_accessible:false,anonymous_settlement_executable:false});
  }
  assert.equal((await db.query('select sum(amount_cents)::int n from public.financial_receipts where financial_entry_id=$1',[entry])).rows[0].n,2000);
  await as(owner,"select public.refund_financial_entry($1,$2,2000,'Full reconciled refund','pix')",[workspace,entry]);
  await assert.rejects(db.transaction(tx=>tx.exec(fix)),/already exists/);
  const {writeFileSync}=await import('node:fs');
  if(db.native)writeFileSync('docs/homologation/pr84-final-migration-stages.json',JSON.stringify(stages,null,2));
});

