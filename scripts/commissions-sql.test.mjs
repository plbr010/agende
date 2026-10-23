import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';

test('commissions, checkout, receipts and permissions stay isolated', async (t) => {
  const db = await createLocalDatabase();
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
  const otherWorkspace = (await as(foreignOwner, "select public.create_workspace('Outro Salao', null, 'solo') result")).rows[0].result.workspace_id;
  const ownerMember = (await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2', [workspace, owner])).rows[0].id;
  await db.query("insert into public.workspace_members(workspace_id,user_id,role,status) values ($1,$2,'professional','active'),($1,$3,'professional','active'),($1,$4,'receptionist','active'),($1,$5,'admin','active')", [workspace, proUser, bareUser, receptionist, admin]);
  const memberId = async (uid) => (await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2', [workspace, uid])).rows[0].id;
  const pro = await memberId(proUser);
  const bare = await memberId(bareUser);
  const receptionMember = await memberId(receptionist);
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

  await t.test('service rule wins over the professional default and later edits do not rewrite it', async () => {
    const specific = await book(pro, color);
    const fallback = await book(pro, colorExtra);
    await advance(specific);
    await advance(fallback);
    const specificSummary = (await checkout(specific, 'checkout-specific-service', 2000)).rows[0].data;
    const fallbackSummary = (await checkout(fallback, 'checkout-default-service')).rows[0].data;
    assert.equal(specificSummary.amount_due_cents, 8000);
    assert.equal(specificSummary.commission.rate_bps, 2500);
    assert.equal(specificSummary.commission.original_cents, 2000);
    assert.equal(specificSummary.commission.status, 'pending');
    assert.equal(specificSummary.commission.released_cents, 0);
    assert.equal(fallbackSummary.commission.rate_bps, 4000);
    assert.equal(fallbackSummary.commission.original_cents, 3200);
    await as(owner, 'select public.set_commission_rule($1,$2,$3,1000)', [workspace, pro, color]);
    const kept = await commissionOf(specific);
    assert.equal(kept.rate_bps, 2500);
    assert.equal(kept.original_commission_cents, 2000);
    await as(owner, 'select public.set_commission_rule($1,$2,$3,2500)', [workspace, pro, color]);
    const open = (await db.query("select count(*)::int n from public.commission_rules where professional_member_id=$1 and service_id=$2 and effective_to is null", [pro, color])).rows[0].n;
    assert.equal(open, 1);
  });

  await t.test('completion without money stays pending, then partial and full receipts release the same rate', async () => {
    const id = await book(pro);
    await advance(id);
    const first = (await checkout(id, 'checkout-unpaid-service')).rows[0].data;
    assert.equal(first.received_cents, 0);
    assert.equal(first.commission.status, 'pending');
    const entry = first.financial_entry_id;
    await as(owner, "select public.record_financial_receipt($1,$2,4000,'pix','receipt-partial-1')", [workspace, entry]);
    let row = await commissionOf(id);
    assert.equal(row.released_cents, 1000);
    assert.equal(row.status, 'released');
    assert.equal((await db.query('select status from public.financial_entries where id=$1', [entry])).rows[0].status, 'pending');
    await as(owner, "select public.record_financial_receipt($1,$2,6000,'pix','receipt-rest-1')", [workspace, entry]);
    row = await commissionOf(id);
    assert.equal(row.released_cents, 2500);
    assert.equal(row.current_commission_cents, 2500);
    assert.equal((await db.query('select status from public.financial_entries where id=$1', [entry])).rows[0].status, 'paid');
    const events = (await db.query('select event_type from public.commission_events where commission_id=$1 order by created_at', [row.id])).rows.map((event) => event.event_type);
    assert.ok(events.includes('calculated'));
    assert.ok(events.includes('money_sync'));
  });

  await t.test('refund and manual ceiling keep history and never raise the original amount', async () => {
    const id = await book(pro);
    await advance(id);
    const summary = (await checkout(id, 'checkout-refund-service', 0, [], 10000, 'pix')).rows[0].data;
    assert.equal(summary.commission.released_cents, 2500);
    await as(owner, "select public.pay_commission($1,2500,current_date,'Pagamento integral','pay-before-refund')", [summary.commission.id]);
    await as(owner, "select public.refund_financial_entry($1,$2,4000,'Estorno parcial do servico','pix',p_idempotency_key=>'refund-partial-1')", [workspace, summary.financial_entry_id]);
    let row = await commissionOf(id);
    assert.equal(row.current_commission_cents, 1500);
    assert.equal(row.status, 'adjusted');
    assert.equal(row.paid_cents, 2500);
    await as(owner, "select public.recover_commission($1,1000,current_date,'Devolucao da comissao','recover-partial-1')", [row.id]);
    row = await commissionOf(id);
    assert.equal(row.paid_cents, 1500);
    await assert.rejects(as(owner, "select public.adjust_commission($1,3000,'Aumento indevido')", [row.id]), /invalid_commission_adjustment/);
    await as(owner, "select public.adjust_commission($1,1000,'Correcao combinada')", [row.id]);
    row = await commissionOf(id);
    assert.equal(row.current_commission_cents, 1000);
    assert.equal(row.manual_ceiling_cents, 1000);
    const history = (await db.query('select count(*)::int n from public.commission_events where commission_id=$1', [row.id])).rows[0].n;
    assert.ok(history >= 4);
  });

  await t.test('cancel and no-show do not create commission or service income', async () => {
    const missed = await book(pro);
    const dropped = await book(pro);
    await as(owner, "select public.set_appointment_status($1,'confirmed')", [missed]);
    await as(owner, "select public.set_appointment_status($1,'no_show')", [missed]);
    await as(owner, "select public.set_appointment_status($1,'cancelled')", [dropped]);
    for (const id of [missed, dropped]) {
      assert.equal(await commissionOf(id), undefined);
      assert.equal((await db.query("select count(*)::int n from public.financial_entries where appointment_id=$1", [id])).rows[0].n, 0);
    }
  });

  await t.test('professional change before completion follows the appointment, and after close needs an audited reassignment', async () => {
    const id = await book(ownerMember, colorExtra);
    const localDate = (await db.query("select (starts_at at time zone 'America/Sao_Paulo')::date::text d from public.appointments where id=$1", [id])).rows[0].d;
    await as(owner, "select public.reschedule_appointment($1,$2,$3,($4::date+time '17:00') at time zone 'America/Sao_Paulo',null)", [id, pro, colorExtra, localDate]);
    await advance(id);
    const summary = (await checkout(id, 'checkout-swapped-pro')).rows[0].data;
    assert.equal(summary.commission.professional_member_id, pro);
    assert.equal(summary.commission.rate_bps, 4000);
    await as(owner, "select public.reassign_commission($1,$2,'Atendimento foi da outra profissional')", [summary.commission.id, bare]);
    const row = await commissionOf(id);
    assert.equal(row.professional_member_id, bare);
    assert.equal(row.original_commission_cents, summary.commission.original_cents);
    const moved = (await db.query("select count(*)::int n from public.commission_events where commission_id=$1 and event_type='beneficiary_changed'", [row.id])).rows[0].n;
    assert.equal(moved, 1);
  });

  await t.test('package redemption cancels the pending service receivable and does not recreate it', async () => {
    const pack = (await as(owner, "select public.create_service_package($1,'Pacote corte','Quatro cortes',20000,60,$2::jsonb) id", [workspace, JSON.stringify([{ service_id: color, quantity: 4 }])])).rows[0].id;
    const sale = (await as(owner, 'select public.sell_service_package($1,$2,$3) id', [workspace, client, pack])).rows[0].id;
    const id = await book(pro);
    await advance(id);
    const summary = (await checkout(id, 'checkout-package-session')).rows[0].data;
    assert.equal(summary.commission.original_cents, 2500);
    const saleEntries = (await db.query("select count(*)::int n from public.financial_entries where client_package_id=$1 and source='package_sale' and status<>'cancelled'", [sale])).rows[0].n;
    await as(owner, 'select public.redeem_client_package($1,$2,$3)', [workspace, sale, id]);
    const service = (await db.query("select status from public.financial_entries where appointment_id=$1 and source='appointment'", [id])).rows[0];
    assert.equal(service.status, 'cancelled');
    const row = await commissionOf(id);
    assert.equal(row.current_commission_cents, 0);
    assert.equal(row.status, 'adjusted');
    assert.equal((await db.query("select count(*)::int n from public.financial_entries where client_package_id=$1 and source='package_sale' and status<>'cancelled'", [sale])).rows[0].n, saleEntries);
    const redemption = (await db.query('select id from public.package_redemptions where appointment_id=$1 and reversed_at is null', [id])).rows[0].id;
    await as(owner, "select public.reverse_package_redemption($1,$2,'Sessao desfeita')", [workspace, redemption]);
    assert.equal((await db.query("select count(*)::int n from public.financial_entries where appointment_id=$1 and source='appointment' and status<>'cancelled'", [id])).rows[0].n, 0);
    assert.equal((await commissionOf(id)).current_commission_cents, 0);
  });

  await t.test('repeated checkout and receipt keys do not duplicate money', async () => {
    const id = await book(bare);
    await advance(id);
    const first = (await checkout(id, 'checkout-repeat-key')).rows[0].data;
    const second = (await checkout(id, 'checkout-repeat-key')).rows[0].data;
    const third = (await checkout(id, 'checkout-other-key')).rows[0].data;
    assert.equal(first.repeated, false);
    assert.equal(second.repeated, true);
    assert.equal(third.repeated, true);
    assert.equal(second.settlement_id, first.settlement_id);
    assert.equal((await db.query('select count(*)::int n from public.appointment_settlements where appointment_id=$1', [id])).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int n from public.financial_entries where appointment_id=$1 and source='appointment'", [id])).rows[0].n, 1);
    assert.equal(first.commission, null);
    const other = await book(bare);
    await advance(other);
    await assert.rejects(checkout(other, 'checkout-repeat-key'), /idempotency_key_conflict/);
    await as(owner, "select public.record_financial_receipt($1,$2,1000,'cash','receipt-same-key')", [workspace, first.financial_entry_id]);
    await as(owner, "select public.record_financial_receipt($1,$2,1000,'cash','receipt-same-key')", [workspace, first.financial_entry_id]);
    assert.equal((await db.query('select coalesce(sum(amount_cents),0)::int n from public.financial_receipts where financial_entry_id=$1', [first.financial_entry_id])).rows[0].n, 1000);
  });

  await t.test('products leave stock once and stay out of the commission base', async () => {
    const product = (await as(owner, "select public.create_inventory_product($1,'Oleo',p_initial_quantity=>10,p_minimum_quantity=>1,p_cost_cents=>500) p", [workspace])).rows[0].p.id;
    const id = await book(pro);
    await advance(id);
    const summary = (await checkout(id, 'checkout-with-product', 0, [{ product_id: product, quantity: 1.5, unit_price_cents: 1000 }], 1500, 'pix')).rows[0].data;
    assert.equal(summary.product_total_cents, 1500);
    assert.equal(summary.received_cents, 1500);
    assert.equal(summary.commission.eligible_cents, 10000);
    assert.equal((await db.query('select quantity::float from public.inventory_products where id=$1', [product])).rows[0].quantity, 8.5);
    const productEntry = (await db.query('select status, amount_cents from public.financial_entries where linked_settlement_id=$1 and appointment_id is null', [summary.settlement_id])).rows[0];
    assert.equal(productEntry.amount_cents, 1500);
    assert.equal(productEntry.status, 'pending');
    const serviceEntry = (await db.query('select status from public.financial_entries where id=$1', [summary.financial_entry_id])).rows[0];
    assert.equal(serviceEntry.status, 'pending');
  });

  await t.test('full discount creates neither receivable nor commission, and on_completion releases before receipt', async () => {
    const free = await book(pro);
    await advance(free);
    const freeSummary = (await checkout(free, 'checkout-full-discount', 10000)).rows[0].data;
    assert.equal(freeSummary.amount_due_cents, 0);
    assert.equal(freeSummary.financial_entry_id, null);
    assert.equal(freeSummary.commission, null);
    await as(owner, "select public.set_commission_release_policy($1,'on_completion')", [workspace]);
    const id = await book(pro);
    await advance(id);
    const summary = (await checkout(id, 'checkout-release-now')).rows[0].data;
    assert.equal(summary.release_policy, 'on_completion');
    assert.equal(summary.commission.released_cents, summary.commission.original_cents);
    assert.equal(summary.commission.status, 'released');
    assert.equal(summary.received_cents, 0);
    const partial = (await as(owner, "select public.pay_commission($1,$2,current_date,null,'pay-half-commission') id", [summary.commission.id, Math.floor(summary.commission.released_cents / 2)])).rows[0].id;
    await as(owner, "select public.pay_commission($1,$2,current_date,null,'pay-half-commission')", [summary.commission.id, Math.floor(summary.commission.released_cents / 2)]);
    const rest = summary.commission.released_cents - Math.floor(summary.commission.released_cents / 2);
    await as(owner, "select public.pay_commission($1,$2,current_date,'Resto da comissao','pay-rest-commission')", [summary.commission.id, rest]);
    const row = await commissionOf(id);
    assert.equal(row.paid_cents, row.current_commission_cents);
    assert.equal(row.status, 'paid');
    assert.equal((await db.query('select count(*)::int n from public.commission_payments where id=$1 or commission_id=$2', [partial, row.id])).rows[0].n, 2);
    await as(owner, "select public.set_commission_release_policy($1,'on_receipt')", [workspace]);
    assert.equal((await commissionOf(id)).release_policy, 'on_completion');
  });

  await t.test('a rate added after completion does not create a retroactive commission', async () => {
    const id = await book(bare);
    await advance(id);
    await as(owner, "select public.set_appointment_status($1,'completed')", [id]);
    assert.equal(await commissionOf(id), undefined);
    await as(owner, 'select public.set_commission_rule($1,$2,null,5000)', [workspace, bare]);
    const entry = (await db.query("select id from public.financial_entries where appointment_id=$1 and source='appointment'", [id])).rows[0].id;
    await as(owner, "select public.record_financial_receipt($1,$2,10000,'pix','receipt-historical')", [workspace, entry]);
    assert.equal(await commissionOf(id), undefined);
  });

  await t.test('permissions stop cross-professional, cross-salon and privilege escalation', async () => {
    const sample = (await db.query('select id, professional_member_id from public.commission_entries where workspace_id=$1 and professional_member_id=$2 limit 1', [workspace, pro])).rows[0];
    const own = (await as(proUser, 'select public.get_commissions_ui($1,$2) data', [workspace, ownerMember])).rows[0].data;
    assert.equal(own.viewer, 'own');
    assert.ok(own.entries.every((entry) => entry.professional_member_id === pro));
    await assert.rejects(as(proUser, 'select public.get_commissions_ui($1,null)', [otherWorkspace]), /not_authorized/);
    await assert.rejects(as(proUser, 'select public.pay_commission($1,1,current_date,null,$2)', [sample.id, 'pay-denied-pro']), /not_authorized|commission_exceeds_released/);
    await assert.rejects(as(proUser, 'select public.set_commission_rule($1,$2,null,9000)', [workspace, pro]), /not_authorized/);
    assert.equal((await as(foreignOwner, 'select id from public.commission_entries where workspace_id=$1', [workspace])).rows.length, 0);
    await assert.rejects(as(receptionist, 'select public.get_finance_ui($1,current_date,current_date)', [workspace]), /not_authorized/);
    await as(owner, "select public.set_member_permission($1,'finance.view','grant')", [pro]);
    const finance = (await as(proUser, 'select public.get_finance_ui($1,current_date - 1,current_date + 1) data', [workspace])).rows[0].data;
    assert.ok(Array.isArray(finance.entries));
    await assert.rejects(as(proUser, 'select public.get_workspace_advanced_report($1,current_date,current_date)', [workspace]), /not_authorized/);
    await as(owner, "select public.set_member_permission($1,'reports.view','grant')", [pro]);
    assert.ok((await as(proUser, 'select public.get_workspace_advanced_report($1,current_date,current_date) data', [workspace])).rows[0].data.period);
    await as(owner, "select public.set_member_permission($1,'clients.view','deny')", [receptionMember]);
    assert.equal((await as(receptionist, 'select id from public.workspace_clients where workspace_id=$1', [workspace])).rows.length, 0);
    await assert.rejects(as(admin, "select public.set_member_permission($1,'finance.manage','grant')", [pro]), /not_authorized/);
    await assert.rejects(as(owner, "select public.set_member_permission($1,'finance.manage','deny')", [ownerMember]), /owner_permissions_locked/);
    await as(owner, "select public.set_member_permission($1,'commissions.pay','grant')", [receptionMember]);
    const payer = (await as(receptionist, 'select public.get_commissions_ui($1,null) data', [workspace])).rows[0].data;
    assert.equal(payer.viewer, 'team');
    await assert.rejects(as(receptionist, "select public.adjust_commission($1,0,'Sem permissao')", [sample.id]), /not_authorized/);
  });

  await t.test('checkout locks the appointment and money tables reject a second settlement', async () => {
    const source = (await db.query("select pg_get_functiondef('app.complete_appointment_checkout(uuid,text,integer,jsonb,integer,public.payment_method)'::regprocedure) def")).rows[0].def;
    assert.match(source, /FOR UPDATE/);
    const indexes = (await db.query("select indexrelid::regclass::text as name from pg_index join pg_class on pg_class.oid=pg_index.indexrelid where pg_get_indexdef(indexrelid) ilike '%appointment_settlements%' and indisunique")).rows.map((row) => row.name);
    assert.ok(indexes.length >= 2);
    const id = await book(pro);
    await advance(id);
    await checkout(id, 'checkout-lock-once');
    await assert.rejects(db.query('insert into public.appointment_settlements(workspace_id,appointment_id,idempotency_key,professional_member_id,service_id,list_price_cents,discount_cents,amount_due_cents,release_policy,commission_rate_bps,commission_eligible_cents,commission_cents) select workspace_id,id,$2,professional_member_id,service_id,price_cents,0,price_cents,$3,0,0,0 from public.appointments where id=$1', [id, 'checkout-lock-dup', 'on_receipt']), /duplicate key|unique/);
  });
});
