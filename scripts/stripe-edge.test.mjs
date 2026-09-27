import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHmac, webcrypto } from 'node:crypto';
import ts from 'typescript';

const wid = '11111111-1111-4111-8111-111111111111';
const now = Math.floor(Date.now() / 1000);
const snapshot = (status = 'active', lookup = 'agende_equipe_annual') => ({
  id: 'sub_test', customer: 'cus_test', status, metadata: { app: 'agende', plan_code: 'solo', billing_interval: 'monthly' },
  items: { data: [{ price: { id: 'test_price', lookup_key: lookup }, current_period_start: now, current_period_end: now + 86400 }] },
});

// Execute the actual Edge entrypoints with only their platform imports replaced.
// All Stripe/Supabase calls are mocks; network access is never provided to the VM.
function harness(kind, overrides = {}) {
  const state = { calls: [], role: 'owner', seats: 1, subscriptions: [], sessions: [],
    subscription: { status: 'trialing', trial_ends_at: new Date((now + 7 * 86400) * 1000).toISOString(),
      external_customer_id: 'cus_test', external_subscription_id: null }, current: snapshot(), ...overrides };
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: 'user_test', email: 'owner@test.invalid', email_confirmed_at: '2026-01-01' } }, error: null }) },
    from(table) {
      const query = { select() { return this; }, eq() { return this; }, in() { return this; },
        async maybeSingle() {
          return { data: table === 'billing_events' ? state.seen ? { id: 'seen' } : null
            : table === 'workspace_members' ? { role: state.role, status: 'active' }
            : table === 'workspaces' ? { id: wid, name: 'Test' }
            : kind === 'stripe-webhook' ? state.unbound ? null : { workspace_id: wid, plan: 'solo', billing_interval: 'monthly', external_customer_id: 'cus_test' }
            : state.subscription, error: null };
        },
        then(resolve) { return Promise.resolve({ count: state.seats, error: null }).then(resolve); },
      };
      return query;
    },
    async rpc(name, args) {
      state.calls.push({ name, args });
      if (name === 'get_stripe_webhook_secret') return { data: 'whsec_mock', error: null };
      if (name === 'get_stripe_api_key') return { data: 'mock_key', error: null };
      if (name === 'acquire_stripe_checkout') return { data: !state.locked, error: null };
      return { data: null, error: null };
    },
  };
  const iterable = values => ({ async *[Symbol.asyncIterator]() { yield* values; } });
  const stripe = {
    customers: { retrieve: async () => ({ id: 'cus_test' }), create: async () => ({ id: 'cus_test' }) },
    prices: { list: async ({ lookup_keys: [lookup] }) => {
      const plan = lookup.split('_')[1], annual = lookup.endsWith('annual');
      return { data: [{ id: 'price_test', lookup_key: lookup, currency: 'brl', unit_amount: state.badPrice ? 1 :
        { solo: [8990, 79900], equipe: [16990, 149900], salao: [29990, 279900] }[plan][annual ? 1 : 0],
        recurring: { interval: annual ? 'year' : 'month', interval_count: 1, usage_type: 'licensed' } }] };
    } },
    subscriptions: { list: () => iterable(state.subscriptions), retrieve: async () => state.current },
    checkout: { sessions: { list: () => iterable(state.sessions), expire: async id => { state.calls.push({ name: 'expire', id }); }, create: async (args, options) => {
      state.calls.push({ name: 'checkout', args, options }); return { url: 'https://checkout.stripe.com/c/pay/test' };
    } } },
    billingPortal: { sessions: { create: async args => { state.calls.push({ name: 'portal', args }); return { url: 'https://billing.stripe.com/p/session/test' }; } } },
  };
  class Stripe { constructor() { return stripe; } static createFetchHttpClient() {} }
  let handler;
  const source = readFileSync(`supabase/functions/${kind}/index.ts`, 'utf8').replace(/^import .*;\r?\n/gm, '');
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  runInNewContext(js, { createClient: () => admin, Stripe, crypto: webcrypto, TextEncoder, Response, Date, console: { error() {} },
    Deno: { env: { get: name => ({ SUPABASE_URL: 'https://local.invalid', SUPABASE_SERVICE_ROLE_KEY: 'mock', AGENDE_SITE_URL: 'https://agende.test' })[name] }, serve: fn => { handler = fn; } } });
  return { state,
    async billing(body = {}) {
      return handler(new Request('https://local.invalid', { method: 'POST', headers: { authorization: 'Bearer mock' },
        body: JSON.stringify({ action: 'checkout', workspaceId: wid, plan: 'solo', billingInterval: 'monthly', idempotencyKey: 'attempt-1234567890', ...body }) }));
    },
    async event(type, object, { invalidSignature = false, timestamp = now } = {}) {
      const body = JSON.stringify({ id: 'evt_mock', type, created: timestamp, data: { object } });
      const signature = createHmac('sha256', 'whsec_mock').update(`${timestamp}.${body}`).digest('hex');
      return handler(new Request('https://local.invalid', { method: 'POST', body,
        headers: { 'stripe-signature': `t=${timestamp},v1=${invalidSignature ? 'bad' : signature}` } }));
    },
  };
}

test('Edge checkout: six existing lookup keys, fixed redirects, seat checks and verified managers', async () => {
  for (const plan of ['solo', 'equipe', 'salao']) for (const billingInterval of ['monthly', 'annual']) {
    const h = harness('stripe-billing');
    assert.equal((await h.billing({ plan, billingInterval, success_url: 'https://evil.test' })).status, 200);
    const call = h.state.calls.find(c => c.name === 'checkout');
    assert.equal(call.args.success_url, 'https://agende.test/app/configuracoes/assinatura?checkout=success');
    assert.equal(call.args.subscription_data.metadata.plan_code, plan);
    assert.ok(call.options.idempotencyKey.includes(wid));
  }
  for (const role of ['professional', 'receptionist']) assert.equal((await harness('stripe-billing', { role }).billing()).status, 403);
  assert.equal((await harness('stripe-billing', { seats: 2 }).billing()).status, 409);
  assert.equal((await harness('stripe-billing', { badPrice: true }).billing()).status, 409);
});

test('Edge preserves original trial end and never resets or charges the last minutes', async () => {
  for (const seconds of [7 * 86400, 47 * 3600, 120, -1]) {
    const end = now + seconds;
    const h = harness('stripe-billing', { subscription: { status: 'trialing', trial_ends_at: new Date(end * 1000).toISOString(), external_customer_id: 'cus_test' } });
    const response = await h.billing();
    if (seconds === 120) { assert.equal(response.status, 409); assert.equal(h.state.calls.some(c => c.name === 'checkout'), false); continue; }
    assert.equal(response.status, 200);
    const data = h.state.calls.find(c => c.name === 'checkout').args.subscription_data;
    if (seconds > 48 * 3600) assert.equal(data.trial_end, end);
    else if (seconds > 0) { assert.equal(data.billing_cycle_anchor, end); assert.equal(data.proration_behavior, 'none'); }
    else { assert.equal(data.trial_end, undefined); assert.equal(data.billing_cycle_anchor, undefined); }
    assert.equal(data.trial_period_days, undefined);
  }
});

test('Edge prevents known duplicates, reuses open checkout and requires customer for portal', async () => {
  assert.equal((await harness('stripe-billing', { locked: true }).billing()).status, 409);
  for (const status of ['active', 'trialing', 'past_due', 'paused', 'incomplete', 'unpaid']) {
    assert.equal((await harness('stripe-billing', { subscriptions: [{ status }] }).billing()).status, 409);
  }
  const h = harness('stripe-billing', { sessions: [{ mode: 'subscription', metadata: { app: 'agende', plan_code: 'solo', billing_interval: 'monthly' }, url: 'https://checkout.stripe.com/reused' }] });
  assert.equal((await (await h.billing()).json()).url, 'https://checkout.stripe.com/reused');
  assert.equal(h.state.calls.some(c => c.name === 'checkout'), false);
  assert.equal((await h.billing({ plan: 'equipe' })).status, 200);
  assert.ok(h.state.calls.some(c => c.name === 'expire'));
  assert.equal((await harness('stripe-billing').billing({ action: 'portal' })).status, 200);
  assert.equal((await harness('stripe-billing', { subscription: {} }).billing({ action: 'portal' })).status, 409);
});

test('Webhook validates signatures and reconciles current state, not stale event or invoice status', async () => {
  for (const status of ['trialing', 'active', 'past_due', 'canceled', 'paused']) {
    const h = harness('stripe-webhook', { current: snapshot(status) });
    assert.equal((await h.event('invoice.paid', { subscription: 'sub_test', amount_paid: 0, status: 'paid' })).status, 200);
    const sync = h.state.calls.find(c => c.name === 'sync_billing_subscription').args;
    assert.equal(sync.p_status, status === 'paused' ? 'expired' : status);
    assert.equal(sync.p_plan, 'equipe');
    assert.equal(sync.p_billing_interval, 'annual');
    assert.equal(sync.p_current_period_end, new Date((now + 86400) * 1000).toISOString());
  }
  const h = harness('stripe-webhook', { current: snapshot('canceled') });
  assert.equal((await h.event('customer.subscription.updated', snapshot('active'))).status, 200);
  assert.equal(h.state.calls.find(c => c.name === 'sync_billing_subscription').args.p_status, 'canceled');
  for (const options of [{ invalidSignature: true }, { timestamp: now - 600 }]) {
    const invalid = harness('stripe-webhook');
    assert.equal((await invalid.event('customer.subscription.updated', snapshot(), options)).status, 400);
    assert.equal(invalid.state.calls.some(c => c.name === 'sync_billing_subscription'), false);
  }
});

test('Webhook binds checkout then reconciles; unknown prices and missing bindings retry', async () => {
  const h = harness('stripe-webhook');
  assert.equal((await h.event('checkout.session.completed', { mode: 'subscription', client_reference_id: wid,
    customer: 'cus_test', subscription: 'sub_test', customer_details: { email: 'billing@test.invalid' },
    metadata: { app: 'agende', manager_email: 'owner@test.invalid', plan_code: 'solo', billing_interval: 'monthly' } })).status, 200);
  assert.equal(h.state.calls.find(c => c.name === 'bind_stripe_checkout').args.p_payer_email, 'owner@test.invalid');
  assert.ok(h.state.calls.find(c => c.name === 'sync_billing_subscription'));
  assert.equal((await harness('stripe-webhook', { current: snapshot('active', 'unknown') }).event('customer.subscription.updated', snapshot())).status, 409);
  assert.equal((await harness('stripe-webhook', { unbound: true }).event('invoice.payment_failed', { parent: { subscription_details: { subscription: 'sub_test' } } })).status, 409);
});
