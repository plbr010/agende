import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

test('real SQL migrations: trial, tenant authorization and management operations', async t => {
  const db = await createLocalDatabase();
  t.after(() => db.close());
  await db.exec(readFileSync('supabase/tests/helpers.sql','utf8'));
  let sequence = 0;
  const user = async (confirmed = true) => (await db.query("select test_helpers.create_auth_user($1,'professional',$2) as id", ['user' + sequence++ + '@agende-local.test', confirmed])).rows[0].id;
  const as = (uid, sql, params = []) => db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role','authenticated',true)", [uid]);
    await tx.exec('set local role authenticated');
    return tx.query(sql,params);
  });
  const create = async (uid, plan = 'equipe') => (await as(uid, 'select public.create_workspace($1,null,$2) as result',['Estúdio Local '+sequence++,plan])).rows[0].result;
  const owner = await user();
  const workspace = await create(owner);
  const wid = workspace.workspace_id;

  await t.test('selected plans, invalid plan, confirmed email and anonymous access', async () => {
    for (const plan of ['solo','equipe','salao']) {
      const result = await create(await user(),plan);
      assert.equal(result.plan,plan);
      assert.equal(result.status,'trialing');
      assert.equal(Date.parse(result.trial_ends_at)-Date.parse(result.trial_started_at),7*86400000);
    }
    await assert.rejects(create(await user(),'premium'), /invalid_plan/);
    await assert.rejects(create(await user(),null), /invalid_plan/);
    await assert.rejects(create(await user(false)), /email_not_confirmed/);
    await assert.rejects(db.transaction(async tx => { await tx.exec('set local role anon'); await tx.query("select public.create_workspace('Anônimo',null,'solo')"); }), /permission denied/);
  });
  await t.test('second workspace never earns another trial', async () => {
    const second = await create(owner,'salao');
    assert.equal(second.status,'expired');
    assert.equal(second.plan,'salao');
    assert.equal(second.trial_started,false);
    assert.equal(second.trial_started_at,null);
    assert.equal(second.trial_ends_at,null);
    assert.equal((await db.query('select count(*)::int as n from public.professional_trial_claims where user_id=$1',[owner])).rows[0].n,1);
  });
  await t.test('trial plan change preserves all dates and rejects invalid/expired trials', async () => {
    const before=(await db.query('select * from public.subscriptions where workspace_id=$1',[wid])).rows[0];
    await as(owner,"select public.change_trial_plan($1,'salao')",[wid]);
    const after=(await db.query('select * from public.subscriptions where workspace_id=$1',[wid])).rows[0];
    assert.equal(after.plan,'salao');
    for (const key of ['trial_started_at','trial_ends_at','current_period_start','current_period_end']) assert.deepEqual(after[key],before[key]);
    await assert.rejects(as(owner,"select public.change_trial_plan($1,'invalid')",[wid]),/invalid_plan/);
    const expired = await create(owner);
    await assert.rejects(as(owner,"select public.change_trial_plan($1,'solo')",[expired.workspace_id]),/subscription|trial/);
  });
  const professional=await user(), receptionist=await user(), admin=await user(), outsider=await user();
  await db.query("insert into public.workspace_members(workspace_id,user_id,role,status) values ($1,$2,'professional','active'),($1,$3,'receptionist','active'),($1,$4,'admin','active')",[wid,professional,receptionist,admin]);
  await t.test('downgrade rejects excess professionals and admin can change eligible plan', async () => {
    await assert.rejects(as(owner,"select public.change_trial_plan($1,'solo')",[wid]),/plan_professional_limit_reached/);
    await as(admin,"select public.change_trial_plan($1,'equipe')",[wid]);
    assert.equal((await db.query('select plan from public.subscriptions where workspace_id=$1',[wid])).rows[0].plan,'equipe');
  });
  await t.test('professionals, receptionists and other tenants cannot change plans or access management reads', async () => {
    for (const uid of [professional,receptionist,outsider]) {
      await assert.rejects(as(uid,"select public.change_trial_plan($1,'salao')",[wid]),/not_authorized/);
      for (const rpc of ['get_inventory_ui','get_packages_ui']) await assert.rejects(as(uid,`select public.${rpc}($1)`,[wid]),/not_authorized/);
      await assert.rejects(as(uid,"select public.get_finance_ui($1,current_date,current_date)",[wid]),/not_authorized/);
      await assert.rejects(as(uid,"select public.get_workspace_advanced_report($1,current_date,current_date)",[wid]),/not_authorized/);
    }
    assert.equal((await as(outsider,'select count(*)::int as n from public.subscriptions where workspace_id=$1',[wid])).rows[0].n,0);
  });
  await t.test('Stripe leases serialize attempts, protect tokens and reject user access', async () => {
    const first = '11111111-1111-4111-8111-111111111111';
    const second = '22222222-2222-4222-8222-222222222222';
    const acquire = async token => (await db.query('select public.acquire_stripe_checkout($1,$2) as ok', [wid, token])).rows[0].ok;
    assert.equal(await acquire(first), true);
    assert.equal(await acquire(second), false);
    await db.query('select public.release_stripe_checkout($1,$2)', [wid, second]);
    assert.equal(await acquire(second), false);
    await db.query('select public.release_stripe_checkout($1,$2)', [wid, first]);
    assert.equal(await acquire(second), true);
    await db.query("update app.stripe_checkout_leases set expires_at = now() - interval '1 second' where workspace_id=$1", [wid]);
    assert.equal(await acquire(first), true);
    await assert.rejects(as(owner, 'select public.acquire_stripe_checkout($1,$2)', [wid, second]), /permission denied/);
    await assert.rejects(as(owner, 'select public.release_stripe_checkout($1,$2)', [wid, first]), /permission denied/);
  });
  await t.test('Stripe binding and subscription lifecycle preserve trial and require service role', async () => {
    const manager = await user();
    const w = (await create(manager)).workspace_id;
    const before = (await db.query('select * from public.subscriptions where workspace_id=$1', [w])).rows[0];
    const email = (await db.query('select email from auth.users where id=$1', [manager])).rows[0].email;
    await assert.rejects(as(manager, "select public.bind_billing_customer($1,'stripe','cus_local')", [w]), /permission denied/);
    await db.query("select public.bind_billing_customer($1,'stripe','cus_local')", [w]);
    await db.query("select public.bind_stripe_checkout($1,$2,'cus_local','sub_local','equipe','annual','evt_local','checkout.session.completed')", [w, email]);
    await assert.rejects(as(manager, "select public.change_trial_plan($1,'salao')", [w]), /subscription_already_exists/);
    for (const status of ['trialing', 'active', 'past_due', 'active', 'canceled']) {
      await db.query("select public.sync_billing_subscription($1,'stripe','cus_local','sub_local','salao','monthly',$2,now(),now()+interval '1 month',null)", [w, status]);
      const row = (await db.query('select * from public.subscriptions where workspace_id=$1', [w])).rows[0];
      assert.equal(row.status, status);
      assert.equal(row.plan, 'salao');
      assert.equal(row.billing_interval, 'monthly');
      assert.deepEqual(row.trial_started_at, before.trial_started_at);
      assert.deepEqual(row.trial_ends_at, before.trial_ends_at);
    }
    await db.query("select public.bind_stripe_checkout($1,$2,'cus_local','sub_new','equipe','annual','evt_new','checkout.session.completed')", [w, email]);
    const after = (await db.query('select * from public.subscriptions where workspace_id=$1', [w])).rows[0];
    assert.equal(after.external_subscription_id, 'sub_new');
    assert.deepEqual(after.trial_ends_at, before.trial_ends_at);
  });
  let product;
  await t.test('inventory create, entry, exit, adjustment, edit, archive, reactivate and insufficient stock', async () => {
    product=(await as(owner,"select public.create_inventory_product($1,'Shampoo',p_initial_quantity=>10,p_minimum_quantity=>2,p_cost_cents=>1200) as p",[wid])).rows[0].p.id;
    await as(owner,"select public.apply_inventory_movement($1,$2,'entry',5)",[wid,product]);
    await as(owner,"select public.apply_inventory_movement($1,$2,'exit',3)",[wid,product]);
    await as(owner,"select public.apply_inventory_movement($1,$2,'adjustment',null,2,'Contagem')",[wid,product]);
    await assert.rejects(as(owner,"select public.apply_inventory_movement($1,$2,'exit',3)",[wid,product]),/insufficient_stock/);
    await as(owner,"select public.update_inventory_product($1,$2,'Shampoo novo',p_minimum_quantity=>3)",[wid,product]);
    let data=(await as(owner,'select public.get_inventory_ui($1) as data',[wid])).rows[0].data;
    assert.equal(data.products[0].quantity,2);
    assert.equal(data.products[0].name,'Shampoo novo');
    assert.equal(data.recent_movements.length,4);
    await as(owner,'select public.archive_inventory_product($1,$2)',[wid,product]);
    await assert.rejects(as(owner,"select public.apply_inventory_movement($1,$2,'entry',1)",[wid,product]),/inventory_product_archived/);
    await as(owner,'select public.reactivate_inventory_product($1,$2)',[wid,product]);
    data=(await as(owner,'select public.get_inventory_ui($1) as data',[wid])).rows[0].data;
    assert.equal(data.products[0].active,true);
    await assert.rejects(as(outsider,"select public.apply_inventory_movement($1,$2,'entry',1)",[wid,product]),/not_authorized/);
  });
  let sale;
  await t.test('packages create and sell use real services, clients, sessions and cancellation rules', async () => {
    const service=(await db.query("insert into public.services(workspace_id,name,duration_minutes,price_cents) values($1,'Corte',30,5000) returning id",[wid])).rows[0].id;
    const client=(await db.query("insert into public.workspace_clients(workspace_id,full_name) values($1,'Cliente Local') returning id",[wid])).rows[0].id;
    const pack=(await as(owner,"select public.create_service_package($1,'Cuidados','Pacote local',10000,30,$2::jsonb) as id",[wid,JSON.stringify([{service_id:service,quantity:3}])])).rows[0].id;
    sale=(await as(owner,'select public.sell_service_package($1,$2,$3) as id',[wid,client,pack])).rows[0].id;
    const data=(await as(owner,'select public.get_packages_ui($1) as data',[wid])).rows[0].data;
    assert.equal(data.catalog[0].items[0].quantity,3);
    assert.equal(data.sales[0].included_total,3);
    assert.equal(data.sales[0].used_total,0);
    assert.equal(data.sales[0].status,'active');
    await as(owner,'select public.cancel_client_package($1,$2)',[wid,sale]);
    assert.equal((await db.query('select status from public.client_packages where id=$1',[sale])).rows[0].status,'cancelled');
    await assert.rejects(as(outsider,'select public.sell_service_package($1,$2,$3)',[wid,client,pack]),/not_authorized/);
  });
  await t.test('finance income/expense, idempotency, payment, refund limits, cancel and reopen', async () => {
    const entry=(await as(owner,"select public.create_financial_entry($1,'income','Venda local',5000,p_due_date=>current_date,p_idempotency_key=>'local-create-1') as id",[wid])).rows[0].id;
    const same=(await as(owner,"select public.create_financial_entry($1,'income','Venda local',5000,p_due_date=>current_date,p_idempotency_key=>'local-create-1') as id",[wid])).rows[0].id;
    assert.equal(same,entry);
    await as(owner,"select public.mark_financial_entry_paid($1,$2,'pix')",[wid,entry]);
    await as(owner,"select public.refund_financial_entry($1,$2,1000,'Devolução parcial','pix',p_idempotency_key=>'local-refund-1')",[wid,entry]);
    await as(owner,"select public.refund_financial_entry($1,$2,1000,'Devolução parcial','pix',p_idempotency_key=>'local-refund-1')",[wid,entry]);
    await assert.rejects(as(owner,"select public.refund_financial_entry($1,$2,5000,'Devolução excedente','pix')",[wid,entry]),/refund_exceeds_paid_amount/);
    const expense=(await as(owner,"select public.create_financial_entry($1,'expense','Compra',2000,p_due_date=>current_date) as id",[wid])).rows[0].id;
    await as(owner,'select public.cancel_financial_entry($1,$2)',[wid,expense]);
    await as(owner,'select public.reopen_financial_entry($1,$2)',[wid,expense]);
    assert.equal((await db.query('select status from public.financial_entries where id=$1',[expense])).rows[0].status,'pending');
    const data=(await as(owner,'select public.get_finance_ui($1,current_date,current_date) as data',[wid])).rows[0].data;
    assert.equal(data.entries.find(e=>e.id===entry).refunded_cents,1000);
    await assert.rejects(as(outsider,'select public.cancel_financial_entry($1,$2)',[wid,expense]),/not_authorized/);
  });
});
