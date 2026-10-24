import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync } from 'node:fs';
const evidence=[];
import { createLocalDatabase } from './local-database.mjs';

test('commissions, checkout, receipts and permissions stay isolated', async (t) => {
  const db = await createLocalDatabase();
  t.after(async () => {if(db.native)writeFileSync('docs/homologation/pr84-concurrency.json',JSON.stringify(evidence,null,2)+'\n');await db.close();});
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
  const commissionOf = async (appointmentId) => (await db.query('select * from public.commission_entries where appointment_id=$1', [appointmentId])).rows[0];

  await as(owner, 'select public.set_commission_rule($1,$2,null,4000)', [workspace, pro]);
  await as(owner, 'select public.set_commission_rule($1,$2,$3,2500)', [workspace, pro, color]);


  await t.test('A04: retries survive full settlement and reject changed payload',async()=>{
    const id=await book(pro);await advance(id);const s=(await checkout(id,'integrity-retry-checkout')).rows[0].data;
    const sql="select public.record_financial_receipt($1,$2,10000,'pix','integrity-full-receipt') id";
    const a=(await as(owner,sql,[workspace,s.financial_entry_id])).rows[0].id;
    assert.equal((await as(owner,sql,[workspace,s.financial_entry_id])).rows[0].id,a);
    await assert.rejects(as(owner,"select public.record_financial_receipt($1,$2,9999,'pix','integrity-full-receipt')",[workspace,s.financial_entry_id]),/idempotency_key_conflict/);
  });
  await t.test('A01: checkout and snapshots respect commission permissions, including retries',async()=>{
    const id=await book(pro);await advance(id);
    await as(owner,"select public.set_member_permission($1,'commissions.view_own','deny')",[pro]);
    const s=(await as(proUser,"select public.complete_appointment_checkout($1,'integrity-privacy-checkout') data",[id])).rows[0].data;
    assert.equal(s.commission,null);
    assert.equal((await as(proUser,"select public.complete_appointment_checkout($1,'integrity-privacy-repeat') data",[id])).rows[0].data.commission,null);
    assert.equal((await as(receptionist,"select public.complete_appointment_checkout($1,'integrity-privacy-reception') data",[id])).rows[0].data.commission,null);
    await as(owner,"select public.set_member_permission($1,'finance.view','grant')",[bare]);
    assert.equal((await as(bareUser,'select * from public.appointment_settlements where appointment_id=$1',[id])).rows.length,0);
    await as(owner,"select public.set_member_permission($1,'commissions.view_own',null)",[pro]);
    assert.ok((await as(proUser,"select public.complete_appointment_checkout($1,'integrity-privacy-allowed') data",[id])).rows[0].data.commission);
  });
  await t.test('A02/A03: partial cash, method, outstanding and explicit refunds reconcile',async()=>{
    const id=await book(pro);await advance(id);const s=(await checkout(id,'integrity-partial-checkout',0,[],4000,'pix')).rows[0].data;
    const report=(await as(owner,'select public.get_workspace_report($1,current_date,current_date) data',[workspace])).rows[0].data;
    assert.equal(report.finance.paid_income_cents,14000);
    assert.equal(report.finance.pending_income_cents,16000); // unpaid private service + partial balance
    const advanced=(await as(owner,'select public.get_workspace_advanced_report($1,current_date,current_date) data',[workspace])).rows[0].data;
    assert.equal(advanced.payment_methods.find(r=>r.payment_method==='pix').total_cents,14000);
    await assert.rejects(as(owner,'select public.cancel_financial_entry($1,$2)',[workspace,s.financial_entry_id]),/refund_received_money_first/);
    await assert.rejects(as(owner,"select public.refund_financial_entry($1,$2,4001,'Excesso parcial','pix')",[workspace,s.financial_entry_id]),/refund_exceeds_paid_amount/);
    const q="select public.refund_financial_entry($1,$2,4000,'Devolver parcial','pix',p_idempotency_key=>'integrity-partial-refund') id";
    const r=(await as(owner,q,[workspace,s.financial_entry_id])).rows[0].id;
    assert.equal((await as(owner,q,[workspace,s.financial_entry_id])).rows[0].id,r);
    await as(owner,'select public.cancel_financial_entry($1,$2)',[workspace,s.financial_entry_id]);
    assert.equal((await commissionOf(id)).current_commission_cents,0);
    assert.equal((await db.query('select sum(amount_cents)::int n from public.financial_receipts where financial_entry_id=$1',[s.financial_entry_id])).rows[0].n,4000);
  });
  await t.test('A03/B02: package requires explicit refund and never reopens cancelled service',async()=>{
    const pack=(await as(owner,"select public.create_service_package($1,'Pacote seguro','Pacote',20000,60,$2::jsonb) id",[workspace,JSON.stringify([{service_id:color,quantity:4}])])).rows[0].id;
    const sale=(await as(owner,'select public.sell_service_package($1,$2,$3) id',[workspace,client,pack])).rows[0].id;
    const id=await book(pro);await advance(id);const s=(await checkout(id,'integrity-package-checkout',0,[],4000,'pix')).rows[0].data;
    await assert.rejects(as(owner,'select public.redeem_client_package($1,$2,$3)',[workspace,sale,id]),/refund_received_money_first/);
    assert.equal((await db.query('select count(*)::int n from public.package_redemptions where appointment_id=$1',[id])).rows[0].n,0);
    await as(owner,"select public.refund_financial_entry($1,$2,4000,'Devolver para pacote','pix')",[workspace,s.financial_entry_id]);
    await as(owner,'select public.redeem_client_package($1,$2,$3)',[workspace,sale,id]);
    const redemption=(await db.query('select id from public.package_redemptions where appointment_id=$1',[id])).rows[0].id;
    await as(owner,"select public.reverse_package_redemption($1,$2,'Sessao desfeita')",[workspace,redemption]);
    await assert.rejects(as(owner,'select public.reopen_financial_entry($1,$2)',[workspace,s.financial_entry_id]),/package_receivable_cannot_reopen/);
  });
  await t.test('A06/A07: reopen restores stock debit, legacy settlement records only remainder',async()=>{
    const product=(await as(owner,"select public.create_inventory_product($1,'Produto seguro',p_initial_quantity=>10,p_minimum_quantity=>1,p_cost_cents=>500) p",[workspace])).rows[0].p.id;
    const id=await book(pro);await advance(id);const s=(await checkout(id,'integrity-product-checkout',0,[{product_id:product,quantity:2,unit_price_cents:1000}])).rows[0].data;
    const entry=(await db.query('select financial_entry_id id from public.appointment_settlement_products where settlement_id=$1',[s.settlement_id])).rows[0].id;
    await as(owner,'select public.cancel_financial_entry($1,$2)',[workspace,entry]);
    await as(owner,'select public.reopen_financial_entry($1,$2)',[workspace,entry]);
    assert.equal((await db.query('select quantity::float n from public.inventory_products where id=$1',[product])).rows[0].n,8);
    await as(owner,"select public.record_financial_receipt($1,$2,500,'cash','integrity-product-partial')",[workspace,entry]);
    await as(owner,"select public.mark_financial_entry_paid($1,$2,'pix')",[workspace,entry]);
    const rows=(await db.query('select payment_method,amount_cents from public.financial_receipts where financial_entry_id=$1 order by amount_cents',[entry])).rows;
    assert.deepEqual(rows.map(r=>[r.payment_method,r.amount_cents]),[['cash',500],['pix',1500]]);
    await as(owner,'select public.reopen_financial_entry($1,$2)',[workspace,entry]);
    await as(owner,"select public.mark_financial_entry_paid($1,$2,'pix')",[workspace,entry]);
    assert.equal((await db.query('select sum(amount_cents)::int n from public.financial_receipts where financial_entry_id=$1',[entry])).rows[0].n,2000);
  });
  await t.test('A06: insufficient stock rolls back reopen and duplicate cancellation restores once',async()=>{
    const product=(await as(owner,"select public.create_inventory_product($1,'Estoque limite',p_initial_quantity=>2,p_minimum_quantity=>1,p_cost_cents=>500) p",[workspace])).rows[0].p.id;
    const id=await book(pro);await advance(id);const s=(await checkout(id,'integrity-stock-limit',0,[{product_id:product,quantity:2,unit_price_cents:1000}])).rows[0].data;
    const entry=(await db.query('select financial_entry_id id from public.appointment_settlement_products where settlement_id=$1',[s.settlement_id])).rows[0].id;
    await as(owner,'select public.cancel_financial_entry($1,$2)',[workspace,entry]);
    await as(owner,"select public.apply_inventory_movement($1,$2,'exit',2,null,'Outra venda')",[workspace,product]);
    await assert.rejects(as(owner,'select public.reopen_financial_entry($1,$2)',[workspace,entry]),/insufficient_stock/);
    assert.equal((await db.query('select status from public.financial_entries where id=$1',[entry])).rows[0].status,'cancelled');
    assert.equal((await db.query('select stock_restored from public.appointment_settlement_products where financial_entry_id=$1',[entry])).rows[0].stock_restored,true);
  });
  await t.test('A08/B05: beneficiary history and commission cash are immutable and idempotent',async()=>{
    const id=await book(pro);await advance(id);const s=(await checkout(id,'integrity-beneficiary',0,[],10000,'pix')).rows[0].data;
    await as(owner,"select public.reassign_commission($1,$2,'Troca antes de pagar')",[s.commission.id,bare]);
    const event=(await db.query("select * from public.commission_events where commission_id=$1 and event_type='beneficiary_changed'",[s.commission.id])).rows[0];
    assert.equal(event.previous_professional_member_id,pro);assert.equal(event.next_professional_member_id,bare);
    const sql="select public.pay_commission($1,2500,current_date,'Pago beneficiaria','integrity-payout') id";
    const pay=(await as(owner,sql,[s.commission.id])).rows[0].id;
    assert.equal((await as(owner,sql,[s.commission.id])).rows[0].id,pay);
    const payment=(await db.query('select * from public.commission_payments where id=$1',[pay])).rows[0];assert.equal(payment.professional_member_id,bare);
    const cash=(await db.query('select * from public.financial_entries where commission_payment_id=$1',[pay])).rows;
    assert.equal(cash.length,1);assert.equal(cash[0].amount_cents,2500);assert.equal(cash[0].entry_type,'expense');
    await assert.rejects(as(owner,"select public.reassign_commission($1,$2,'Troca apos pagar')",[s.commission.id,pro]),/commission_beneficiary_locked_after_payment/);
    await assert.rejects(as(owner,'select public.reopen_financial_entry($1,$2)',[workspace,cash[0].id]),/commission_cash_movement_immutable/);
    await as(owner,"select public.refund_financial_entry($1,$2,4000,'Estorno com comissao','pix')",[workspace,s.financial_entry_id]);
    await as(owner,"select public.recover_commission($1,1000,current_date,'Devolucao efetiva','integrity-recovery')",[s.commission.id]);
    const recovery=(await db.query("select f.* from public.financial_entries f join public.commission_payments p on p.id=f.commission_payment_id where p.commission_id=$1 and p.direction='recovery'",[s.commission.id])).rows[0];
    assert.equal(recovery.entry_type,'income');assert.equal((await db.query('select sum(amount_cents)::int n from public.financial_receipts where financial_entry_id=$1',[recovery.id])).rows[0].n,1000);
    await assert.rejects(as(owner,"select public.refund_financial_entry($1,$2,1000,'Nao desviar recuperacao','pix')",[workspace,recovery.id]),/commission_cash_movement_immutable/);
    await assert.rejects(as(owner,"select public.reassign_commission($1,$2,'Mesmo apos recuperar')",[s.commission.id,pro]),/commission_beneficiary_locked_after_payment/);
    const migration=readFileSync('supabase/migrations/20261024042359_pr84_financial_integrity.sql','utf8');
    const preflight=migration.slice(0,migration.indexOf('ALTER TABLE public.commission_payments'));
    await assert.rejects(db.transaction(tx=>tx.exec(preflight)),/commission_payments_require_reconciliation/);
    assert.equal((await db.query('select professional_member_id from public.commission_payments where id=$1',[pay])).rows[0].professional_member_id,bare);
  });
  await t.test('A01: tenant and colleague authorization across public APIs',async()=>{
    const id=await book(pro);await advance(id);const s=(await checkout(id,'integrity-foreign')).rows[0].data;
    for(const table of ['commission_rules','appointment_settlements','appointment_settlement_products','financial_receipts','commission_entries','commission_events','commission_payments','workspace_member_permissions']){
      assert.equal((await as(foreignOwner,`select * from public.${table} where workspace_id=$1`,[workspace])).rows.length,0);
    }
    for(const [sql,args] of [
      ['select public.set_commission_rule($1,$2,null,9900)',[workspace,pro]],
      ["select public.set_commission_release_policy($1,'on_completion')",[workspace]],
      ['select public.get_commissions_ui($1,null)',[workspace]],
      ["select public.record_financial_receipt($1,$2,1,'pix','integrity-foreign-receipt')",[workspace,s.financial_entry_id]],
      ["select public.pay_commission($1,1,current_date,null,'integrity-foreign-pay')",[s.commission.id]],
      ["select public.recover_commission($1,1,current_date,null,'integrity-foreign-recovery')",[s.commission.id]],
      ["select public.adjust_commission($1,0,'Tentar alterar')",[s.commission.id]],
      ["select public.reassign_commission($1,$2,'Tentar trocar')",[s.commission.id,bare]],
      ["select public.set_member_permission($1,'commissions.pay','grant')",[pro]],
      ["select public.complete_appointment_checkout($1,'integrity-foreign-close')",[id]],
    ]) await assert.rejects(as(foreignOwner,sql,args),/not_authorized|not_workspace_member|appointment_write_denied/);
    await assert.rejects(as(proUser,"select public.set_member_permission($1,'commissions.pay','grant')",[pro]),/not_authorized/);
    await assert.rejects(as(proUser,"select public.pay_commission($1,1,current_date,null,'integrity-own-pay-denied')",[s.commission.id]),/not_authorized/);
  });
  await t.test('B01: explicit inventory grants and denies agree between RLS and RPC',async()=>{
    await assert.rejects(as(bareUser,'select public.get_inventory_ui($1)',[workspace]),/not_authorized/);
    await as(owner,"select public.set_member_permission($1,'inventory.view','grant')",[bare]);
    assert.ok((await as(bareUser,'select public.get_inventory_ui($1) data',[workspace])).rows[0].data.products.length>0);
    await assert.rejects(as(bareUser,"select public.create_inventory_product($1,'Nao autorizado')",[workspace]),/not_authorized/);
    const member=await memberId(admin);
    await as(owner,"select public.set_member_permission($1,'inventory.view','deny')",[member]);
    assert.equal((await as(admin,'select * from public.inventory_products where workspace_id=$1',[workspace])).rows.length,0);
    await assert.rejects(as(admin,'select public.get_inventory_ui($1)',[workspace]),/not_authorized/);
  });
  await t.test('internal helpers are not executable by authenticated or anonymous callers',async()=>{
    for(const fn of ['app.lock_financial_parent(uuid,uuid)','app.lock_commission(uuid,text)','app.guard_financial_integrity()','app.finance_period_payload(uuid,date,date)','app.get_commissions_page(uuid,uuid,timestamptz,uuid,integer)']){
      const r=(await db.query("select has_function_privilege('authenticated',$1,'execute') a,has_function_privilege('anon',$1,'execute') b",[fn])).rows[0];
      assert.equal(r.a,false);assert.equal(r.b,false);
    }
  });
  await t.test('B04: keyset pagination reaches records beyond the first 200 without duplicates',async()=>{
    for(let i=0;i<201;i++){
      const id=await book(pro);await advance(id);await checkout(id,'integrity-page-'+String(i).padStart(5,'0'));
    }
    const seen=new Set();let before=null,beforeId=null,pages=0;
    for(;;){
      const data=(await as(owner,'select public.get_commissions_page($1,null,$2,$3,50) data',[workspace,before,beforeId])).rows[0].data;
      const entries=data.entries.slice(0,50);for(const e of entries){assert.equal(seen.has(e.id),false);seen.add(e.id);}
      pages++;if(data.entries.length<=50)break;
      before=entries.at(-1).created_at;beforeId=entries.at(-1).id;
    }
    const count=(await db.query('select count(*)::int n from public.commission_entries where workspace_id=$1',[workspace])).rows[0].n;
    assert.equal(seen.size,count);assert.ok(count>200);assert.ok(pages>=5);
    const own=(await as(bareUser,'select public.get_commissions_page($1,null,null,null,100) data',[workspace])).rows[0].data;
    assert.ok(own.entries.every(e=>e.professional_member_id===bare));
    await assert.rejects(as(foreignOwner,'select public.get_commissions_page($1,null,null,null,50)',[workspace]),/not_authorized/);
  });

  if(db.native){
    const delay=ms=>new Promise(r=>setTimeout(r,ms));
    async function race(label,first,argsFirst,second,argsSecond){
      const a=await db.connection('integrity_'+label+'_a'),b=await db.connection('integrity_'+label+'_b');let pending;
      try{
        const pidA=(await a.query('select pg_backend_pid() id')).rows[0].id,pidB=(await b.query('select pg_backend_pid() id')).rows[0].id;assert.notEqual(pidA,pidB);
        for(const c of [a,b]){await c.query('begin');await c.query("set local statement_timeout='8s'");await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[owner]);await c.query('set local role authenticated');}
        const r1=await a.query(first,argsFirst);
        pending=b.query(second,typeof argsSecond==='function'?argsSecond(r1):argsSecond).then(result=>({ok:true,result}),e=>({ok:false,code:e.code,message:e.message}));
        let blocked=false;for(let i=0;i<100;i++){const r=(await db.query('select pg_blocking_pids($1) p',[pidB])).rows[0];if(r.p.includes(pidA)){blocked=true;break;}await delay(20);}
        assert.ok(blocked,'expected real lock overlap');await a.query('commit');const r2=await pending;await b.query(r2.ok?'commit':'rollback');
        assert.notEqual(r2.code,'40P01');
        evidence.push({label,pid_a:pidA,pid_b:pidB,verified_block:true,result:r2.ok?'committed':r2.message,code:r2.code??null});return {r1,r2};
      }finally{await a.query('rollback');if(pending)await pending;await b.query('rollback');await a.end();await b.end();}
    }
    await t.test('A04/A05: native last-receipt retries serialize and converge to one ID',async()=>{
      const id=await book(pro);await advance(id);const s=(await checkout(id,'integrity-race-last')).rows[0].data;
      const sql="select public.record_financial_receipt($1,$2,10000,'pix','integrity-race-final-receipt') id";
      const {r1,r2}=await race('receipt_retry',sql,[workspace,s.financial_entry_id],sql,[workspace,s.financial_entry_id]);
      assert.equal(r2.ok,true);assert.equal(r2.result.rows[0].id,r1.rows[0].id);
    });
    await t.test('A05: native repeated checkout has one settlement despite distinct keys',async()=>{
      const id=await book(pro);await advance(id);
      const sql='select public.complete_appointment_checkout($1,$2) data';
      const {r1,r2}=await race('checkout_repeat',sql,[id,'integrity-race-close-one'],sql,[id,'integrity-race-close-two']);
      assert.equal(r2.ok,true);assert.equal(r2.result.rows[0].data.repeated,true);
      assert.equal(r1.rows[0].data.settlement_id,r2.result.rows[0].data.settlement_id);
    });
    await t.test('A03/A05: native receipt prevents concurrent package conversion without refund',async()=>{
      const pack=(await as(owner,"select public.create_service_package($1,'Pacote concorrente','Pacote',20000,60,$2::jsonb) id",[workspace,JSON.stringify([{service_id:color,quantity:4}])])).rows[0].id;
      const sale=(await as(owner,'select public.sell_service_package($1,$2,$3) id',[workspace,client,pack])).rows[0].id;
      const id=await book(pro);await advance(id);const s=(await checkout(id,'integrity-race-package')).rows[0].data;
      const {r2}=await race('receipt_package',"select public.record_financial_receipt($1,$2,4000,'pix','integrity-race-package-money')",[workspace,s.financial_entry_id],
        'select public.redeem_client_package($1,$2,$3)',[workspace,sale,id]);
      assert.equal(r2.ok,false);assert.match(r2.message,/refund_received_money_first/);
      assert.equal((await db.query('select count(*)::int n from public.package_redemptions where appointment_id=$1',[id])).rows[0].n,0);
    });
    await t.test('A05: native payment and receipt serialize in both directions',async()=>{
      for(const paymentFirst of [true,false]){
        const id=await book(pro);await advance(id);const s=(await checkout(id,'integrity-race-pay-'+paymentFirst,0,[],4000,'pix')).rows[0].data;
        const r="select public.record_financial_receipt($1,$2,1000,'pix',$3)";
        // Separate keys in each case, deliberately use actual RPCs to acquire every lock.
        const paySql="select public.pay_commission($1,100,current_date,null,$2)",payArgs=[s.commission.id,'integrity-race-payment-'+paymentFirst],recArgs=[workspace,s.financial_entry_id,'integrity-race-receipt-'+paymentFirst];
        const {r2}=await race('pay_receipt_'+paymentFirst,paymentFirst?paySql:r,paymentFirst?payArgs:recArgs,paymentFirst?r:paySql,paymentFirst?recArgs:payArgs);assert.equal(r2.ok,true);
        const c=await commissionOf(id);assert.equal(c.paid_cents,100);assert.equal(c.released_cents,1250);
      }
    });
    await t.test('A05: native adjustment and receipt preserve release ceiling',async()=>{
      const id=await book(pro);await advance(id);const s=(await checkout(id,'integrity-race-adjust',0,[],4000,'pix')).rows[0].data;
      const {r2}=await race('adjust_receipt',"select public.adjust_commission($1,1000,'Teto acordado')",[s.commission.id],"select public.record_financial_receipt($1,$2,1000,'pix','integrity-race-adjust-receipt')",[workspace,s.financial_entry_id]);
      assert.equal(r2.ok,true);assert.equal((await commissionOf(id)).released_cents,500);
    });
    await t.test('A05: native refund and payment do not deadlock or overpay',async()=>{
      const id=await book(pro);await advance(id);const s=(await checkout(id,'integrity-race-refund',0,[],10000,'pix')).rows[0].data;
      const {r2}=await race('refund_payment',"select public.refund_financial_entry($1,$2,6000,'Estorno concorrente','pix')",[workspace,s.financial_entry_id],"select public.pay_commission($1,1500,current_date,null,'integrity-refund-payment')",[s.commission.id]);
      assert.equal(r2.ok,false);assert.match(r2.message,/commission_exceeds_released/);assert.equal((await commissionOf(id)).paid_cents,0);
    });
  }
});
