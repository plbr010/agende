import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

test('PR84 atomic upgrade preserves legacy cash and supports rollback', async (t) => {
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


  const oldId=await book(pro);await advance(oldId);await as(owner,"select public.set_appointment_status($1,'completed')",[oldId]);
  const oldEntry=(await db.query("select id from public.financial_entries where appointment_id=$1",[oldId])).rows[0].id;
  await as(owner,"select public.mark_financial_entry_paid($1,$2,'pix')",[workspace,oldEntry]);

  const files=readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&f>'20261023185959').sort();
  await assert.rejects(db.transaction(async tx=>{
    await tx.exec(readFileSync('supabase/migrations/'+files[0],'utf8'));
    await tx.exec("select 1/0");
  }),/division by zero/);
  assert.equal((await db.query("select to_regclass('public.commission_entries') id")).rows[0].id,null);
  await db.transaction(async tx=>{for(const file of files)await tx.exec(readFileSync('supabase/migrations/'+file,'utf8'));});
  assert.equal((await db.query('select amount_cents,status from public.financial_entries where id=$1',[oldEntry])).rows[0].status,'paid');
  assert.equal((await db.query('select count(*)::int n from public.financial_receipts where financial_entry_id=$1',[oldEntry])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from public.commission_entries where appointment_id=$1',[oldId])).rows[0].n,0);
  const report=(await as(owner,'select public.get_workspace_report($1,current_date,current_date) data',[workspace])).rows[0].data;
  assert.equal(report.finance.paid_income_cents,10000);
  await as(owner,'select public.set_commission_rule($1,$2,null,4000)',[workspace,pro]);
  await as(owner,"select public.refund_financial_entry($1,$2,1000,'Estorno legado','pix')",[workspace,oldEntry]);
  assert.equal((await db.query('select count(*)::int n from public.commission_entries where appointment_id=$1',[oldId])).rows[0].n,0);
  assert.equal((await db.query("select has_function_privilege('authenticated','app.sync_appointment_commission(uuid,text,text,boolean)','execute') allowed")).rows[0].allowed,false);
  // Receipt date, not receivable creation, decides the cash period.
  const entry=(await as(owner,"select public.create_financial_entry($1,'income','Recebimento em outro dia',8000,current_date) id",[workspace])).rows[0].id;
  await as(owner,"select public.mark_financial_entry_paid($1,$2,'cash',now()-interval '2 day')",[workspace,entry]);
  const past=(await as(owner,'select public.get_workspace_report($1,current_date-2,current_date-2) data',[workspace])).rows[0].data;
  assert.equal(past.finance.paid_income_cents,8000);
  const today=(await as(owner,'select public.get_workspace_report($1,current_date,current_date) data',[workspace])).rows[0].data;
  assert.equal(today.finance.paid_income_cents,10000);assert.equal(today.finance.refunded_income_cents,1000);
});
