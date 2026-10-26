import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync } from 'node:fs';
const evidence=[];
import { createLocalDatabase } from './local-database.mjs';

test('PR84 final monetary regression with real SQL identities', async (t) => {
  const db = await createLocalDatabase();
  t.after(async () => {if(db.native)writeFileSync('docs/homologation/pr84-final-concurrency.json',JSON.stringify(evidence,null,2)+'\n');await db.close();});
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
  const checkout = (id, key, discount = 0, products = [], receive = 0, method = null) => as(
    owner,
    'select public.complete_appointment_checkout($1,$2,$3,$4::jsonb,$5,$6::public.payment_method) data',
    [id, key, discount, JSON.stringify(products), receive, method],
  );

  await as(owner, 'select public.set_commission_rule($1,$2,null,4000)', [workspace, pro]);
  await as(owner, 'select public.set_commission_rule($1,$2,$3,2500)', [workspace, pro, color]);



  await t.test('R01 actual settlement API returns prior result after success and reopening',async()=>{
    const entry=(await as(owner,"select public.create_financial_entry($1,'income','Final retry',10000,current_date) id",[workspace])).rows[0].id;
    await as(owner,"select public.record_financial_receipt($1,$2,4000,'cash','final-first-partial')",[workspace,entry]);
    const q="select public.settle_financial_entry($1,$2,'pix','final-full-settlement') id";
    assert.equal((await as(owner,q,[workspace,entry])).rows[0].id,entry);
    assert.equal((await as(owner,q,[workspace,entry])).rows[0].id,entry);
    await assert.rejects(as(owner,"select public.settle_financial_entry($1,$2,'cash','final-full-settlement')",[workspace,entry]),/idempotency_key_conflict/);
    assert.equal((await as(owner,"select public.mark_financial_entry_paid($1,$2,'pix') id",[workspace,entry])).rows[0].id,entry);
    const receipts=(await db.query('select amount_cents,payment_method from public.financial_receipts where financial_entry_id=$1 order by amount_cents',[entry])).rows;
    assert.deepEqual(receipts,[{amount_cents:4000,payment_method:'cash'},{amount_cents:6000,payment_method:'pix'}]);
    await as(owner,'select public.reopen_financial_entry($1,$2)',[workspace,entry]);
    await as(owner,q,[workspace,entry]);
    assert.equal((await db.query('select status from public.financial_entries where id=$1',[entry])).rows[0].status,'pending');
    await as(owner,"select public.settle_financial_entry($1,$2,'pix','final-reopen-new-operation')",[workspace,entry]);
    assert.equal((await db.query('select sum(amount_cents)::int n from public.financial_receipts where financial_entry_id=$1',[entry])).rows[0].n,10000);
  });
  await t.test('R02 paid products require complete receipts, preserve mixed payments and refund totals',async()=>{
    const product=(await as(owner,"select public.create_inventory_product($1,'Final product',p_initial_quantity=>10,p_minimum_quantity=>1,p_cost_cents=>500) p",[workspace])).rows[0].p.id;
    const id=await book(pro);await advance(id);const s=(await checkout(id,'final-product',0,[{product_id:product,quantity:2,unit_price_cents:1000}])).rows[0].data;
    const entry=(await db.query('select financial_entry_id id from public.appointment_settlement_products where settlement_id=$1',[s.settlement_id])).rows[0].id;
    await as(owner,"select public.record_financial_receipt($1,$2,500,'cash','final-product-partial')",[workspace,entry]);
    await as(owner,"select public.settle_financial_entry($1,$2,'pix','final-product-remaining')",[workspace,entry]);
    assert.equal((await db.query('select sum(amount_cents)::int n from public.financial_receipts where financial_entry_id=$1',[entry])).rows[0].n,2000);
    await as(owner,"select public.refund_financial_entry($1,$2,2000,'Produto devolvido','pix')",[workspace,entry]);
    await assert.rejects(as(owner,"select public.refund_financial_entry($1,$2,1,'Excesso devolucao','pix')",[workspace,entry]),/refund_exceeds/);
    // Simulate a future privileged writer bypassing the normal API: deferred invariant rejects commit.
    await assert.rejects(db.transaction(tx=>tx.query("insert into public.financial_entries(workspace_id,entry_type,status,source,description,amount_cents,paid_at,payment_method) values($1,'income','paid','manual','Missing actual receipt',2000,now(),'pix')",[workspace])),/paid_receipts_mismatch/);
  });
  await t.test('R04 real action module uses database membership permissions and SQL authorization',async()=>{
    const {runInNewContext}=await import('node:vm');const ts=(await import('typescript')).default;
    const mutations=await import('../src/lib/modules/mutations.ts');
    let actor=proUser;
    const exports={};
    const actionSource=readFileSync('src/lib/modules/actions.ts','utf8');
    runInNewContext(ts.transpileModule(actionSource,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require(name){
      if(name==='./mutations')return mutations;
      if(name==='next/cache')return {revalidatePath(){}};
      if(name==='@/lib/auth/session')return {requireConfirmedSession:async()=>{
        if(!actor)throw Error('unauthenticated');
        const membership=(await db.query("select workspace_id,role from public.workspace_members where user_id=$1 and status='active'",[actor])).rows[0];
        if(!membership)throw Error('no_membership');
        const permissions=(await as(actor,'select public.get_my_permissions($1) p',[membership.workspace_id])).rows[0].p;
        return {workspaces:[{id:membership.workspace_id,role:membership.role}],permissions};
      }};
      if(name==='@/lib/supabase/server')return {createClient:async()=>({rpc:async(name,args)=>{
        assert.match(name,/^[a-z_]+$/);const keys=Object.keys(args);keys.forEach(k=>assert.match(k,/^[a-z_]+$/));
        try{return {data:(await as(actor,`select public.${name}(${keys.map((k,i)=>k+' => $'+(i+1)).join(',')}) id`,Object.values(args))).rows[0].id,error:null};}catch(e){return {error:{message:e.message}};}
      }})};throw Error(name);
    }});
    const form=v=>{const f=new FormData();for(const[k,x]of Object.entries(v))f.set(k,x);return f;};
    const product=(await as(owner,"select public.create_inventory_product($1,'Action stock',p_initial_quantity=>1,p_minimum_quantity=>1,p_cost_cents=>500) p",[workspace])).rows[0].p.id;
    const entry=(await as(owner,"select public.create_financial_entry($1,'income','Action settlement',1000,current_date) id",[workspace])).rows[0].id;
    const key='10000000-0000-4000-8000-000000000099';
    const move={action:'movement',id:product,type:'entry',quantity:'1',reason:'Entrada autorizada'};
    assert.ok((await exports.managementAction({},form(move))).error);
    for(const p of ['inventory.move','finance.receive'])await as(owner,"select public.set_member_permission($1,$2,'grant')",[pro,p]);
    assert.ok((await exports.managementAction({},form(move))).success);
    const paid={action:'finance-paid',id:entry,method:'pix',key};
    assert.ok((await exports.managementAction({},form(paid))).success);
    assert.ok((await exports.managementAction({},form(paid))).success);
    assert.equal((await db.query('select count(*)::int n from public.financial_receipts where financial_entry_id=$1',[entry])).rows[0].n,1);
    await as(owner,"select public.set_member_permission($1,'finance.receive','deny')",[pro]);
    assert.ok((await exports.managementAction({},form(paid))).error);
    assert.ok((await exports.managementAction({},form({action:'trial',plan:'equipe'}))).error);
    actor=foreignOwner;assert.ok((await exports.managementAction({},form(paid))).error);
    actor=null;await assert.rejects(exports.managementAction({},form(paid)),/unauthenticated/);
  });
  if(db.native)await t.test('R01 two PG17 connections converge to one settlement operation',async()=>{
    const entry=(await as(owner,"select public.create_financial_entry($1,'income','Concurrent settlement',3000,current_date) id",[workspace])).rows[0].id;
    const a=await db.connection('final_settle_a'),b=await db.connection('final_settle_b');let pending;
    try{
      const pa=(await a.query('select pg_backend_pid() id')).rows[0].id,pb=(await b.query('select pg_backend_pid() id')).rows[0].id;
      for(const c of [a,b]){await c.query('begin');await c.query("set local statement_timeout='8s'");await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[owner]);await c.query('set local role authenticated');}
      const q="select public.settle_financial_entry($1,$2,'pix','final-race-same-key') id";
      const r1=await a.query(q,[workspace,entry]);pending=b.query(q,[workspace,entry]);
      let blocked=false;for(let i=0;i<100;i++){if((await db.query('select pg_blocking_pids($1) p',[pb])).rows[0].p.includes(pa)){blocked=true;break;}await new Promise(r=>setTimeout(r,20));}
      assert.ok(blocked);await a.query('commit');const r2=await pending;await b.query('commit');assert.equal(r1.rows[0].id,r2.rows[0].id);
      evidence.push({case:'settle_same_key',pa,pb,blocked,result:'same entry, one operation and receipt'});
      assert.equal((await db.query('select count(*)::int n from public.financial_settlement_operations where financial_entry_id=$1',[entry])).rows[0].n,1);
      assert.equal((await db.query('select count(*)::int n from public.financial_receipts where financial_entry_id=$1',[entry])).rows[0].n,1);
    }finally{await a.query('rollback');if(pending)await pending;await b.query('rollback');await a.end();await b.end();}
  });
});

