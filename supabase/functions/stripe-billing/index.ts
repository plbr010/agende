
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import Stripe from "npm:stripe@22.6.0";

type Plan = "solo" | "equipe" | "salao";
type BillingInterval = "monthly" | "annual";

const PRICE_CATALOG: Record<Plan, Record<BillingInterval, {
  lookupKey: string;
  amountCents: number;
  stripeInterval: "month" | "year";
  maxProfessionals: number;
}>> = {
  solo: {
    monthly: { lookupKey: "agende_solo_monthly", amountCents: 3990, stripeInterval: "month", maxProfessionals: 1 },
    annual: { lookupKey: "agende_solo_annual", amountCents: 39900, stripeInterval: "year", maxProfessionals: 1 },
  },
  equipe: {
    monthly: { lookupKey: "agende_equipe_monthly", amountCents: 7990, stripeInterval: "month", maxProfessionals: 5 },
    annual: { lookupKey: "agende_equipe_annual", amountCents: 79900, stripeInterval: "year", maxProfessionals: 5 },
  },
  salao: {
    monthly: { lookupKey: "agende_salao_monthly", amountCents: 14990, stripeInterval: "month", maxProfessionals: 15 },
    annual: { lookupKey: "agende_salao_annual", amountCents: 149900, stripeInterval: "year", maxProfessionals: 15 },
  },
};

// Prices of 2026-11-09: Solo 39,90, Equipe 79,90, Salão 149,90 per month and
// R$ 399 / 799 / 1.499 per year (12 months for 10 monthly payments), charged
// upfront and renewed yearly. Existing subscriptions keep their Stripe price
// and are never migrated here.
const ANNUAL_CHECKOUT_ENABLED = true;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const PRODUCTION_BACKEND = SUPABASE_URL && new URL(SUPABASE_URL).hostname.replace(/\.$/, "") === "wohimauqgywshbbejjcl.supabase.co";
const configuredSite = Deno.env.get("AGENDE_SITE_URL") ?? (PRODUCTION_BACKEND ? "https://agendeapp.online" : null);
if (!configuredSite) throw new Error("billing_site_origin_missing");
const siteOrigin = new URL(configuredSite);
const localSite = ["localhost", "127.0.0.1", "[::1]"].includes(siteOrigin.hostname);
if (siteOrigin.username || siteOrigin.password || siteOrigin.pathname !== "/" || siteOrigin.search || siteOrigin.hash ||
  (siteOrigin.protocol !== "https:" && !(localSite && !PRODUCTION_BACKEND && siteOrigin.protocol === "http:"))) {
  throw new Error("billing_site_origin_invalid");
}
const SITE_URL = siteOrigin.origin;

function getAdminKey(): string | null {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      if (typeof parsed?.default === "string" && parsed.default.length > 0) return parsed.default;
    } catch {
      // Fall through to legacy key during the migration window.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? null;
}

const ADMIN_KEY = getAdminKey();
if (!SUPABASE_URL || !ADMIN_KEY) throw new Error("supabase_runtime_env_missing");

const admin = createClient(SUPABASE_URL, ADMIN_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type StripeOperation = "customers_read" | "customers_write" | "prices_read" | "subscriptions_read" | "subscriptions_write" | "invoices_read" | "checkout_sessions_read" | "checkout_sessions_write" | "customer_portal_write";
class StripeOperationError extends Error {
  constructor(public operation: StripeOperation, public reason: string, public parameter?: string, public providerType?: string, public providerStatus?: number, public hint?: string) { super("stripe_operation_failed"); }
}
async function stripeRequest<T>(operation: StripeOperation, run: () => Promise<T>): Promise<T> {
  try { return await run(); } catch (error) {
    const e = error as { type?: string; statusCode?: number; code?: string; param?: string; message?: string };
    // Declined card on an immediate charge (switch to annual): the change is not applied.
    if (e.type === "StripeCardError" || e.code === "card_declined") throw new Error("payment_declined");
    const reason = e.statusCode === 403 ? "permission_missing" : e.statusCode === 401 ? "credentials_rejected"
      : ["parameter_unknown", "parameter_missing", "parameter_invalid_empty", "email_invalid", "resource_missing", "invalid_api_version", "account_invalid", "url_invalid", "api_key_expired", "livemode_mismatch"].includes(e.code ?? "") ? e.code! : "provider_request_failed";
    const parameter = ["email", "name", "metadata", "metadata[app]", "metadata[workspace_id]", "integration_identifier", "origin_context", "customer", "line_items", "success_url", "cancel_url", "return_url", "payment_method_collection", "subscription_data[billing_mode][type]"].includes(e.param ?? "") ? e.param : undefined;
    const providerType = ["StripeInvalidRequestError", "StripeAPIError", "StripeAuthenticationError", "StripePermissionError", "StripeRateLimitError", "StripeConnectionError", "StripeIdempotencyError", "StripeUnknownError"].includes(e.type ?? "") ? e.type : undefined;
    const providerStatus = Number.isInteger(e.statusCode) && e.statusCode! >= 400 && e.statusCode! <= 599 ? e.statusCode : undefined;
    const classifications: [string, RegExp][] = [
      ["api_version_rejected", /invalid.*api.*version|unsupported.*api.*version/i],
      ["key_scope_rejected", /restricted.*key|permissions?/i],
      ["idempotency_mismatch", /idempotent.*parameters|idempotency.*same/i],
      ["account_not_ready", /account.*claimed|account.*activat|account.*verif/i],
      ["email_rejected", /email.*invalid|invalid.*email/i],
      ["request_encoding_rejected", /form.*encod|encod.*body/i],
    ];
    const hint = classifications.find(([,pattern]) => pattern.test(e.message ?? ""))?.[0];
    throw new StripeOperationError(operation, reason, parameter, providerType, providerStatus, hint);
  }
}
async function stripeItems<T>(operation: StripeOperation, items: AsyncIterable<T>): Promise<T[]> {
  return stripeRequest(operation, async () => { const rows: T[] = []; for await (const row of items) rows.push(row); return rows; });
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function parsePlan(value: unknown): Plan | null {
  return value === "solo" || value === "equipe" || value === "salao" ? value : null;
}

function parseInterval(value: unknown): BillingInterval | null {
  return value === "monthly" || value === "annual" ? value : null;
}

// Campaign attribution for the Rastreio tracker: its Stripe webhook reads `vid`
// and `utm_*` from the Checkout Session metadata. client_reference_id stays the
// workspace id, which stripe-webhook binds by. Unknown keys and unsafe values are
// dropped; attribution never blocks a checkout.
const ATTRIBUTION_KEYS = ["vid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "landing"] as const;
const ATTRIBUTION_VALUE = /^[\p{L}\p{N} ._\-+|:/]{1,100}$/u;

function parseAttribution(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!value || typeof value !== "object") return result;
  for (const key of ATTRIBUTION_KEYS) {
    const raw = (value as Record<string, unknown>)[key];
    if (typeof raw !== "string" || !ATTRIBUTION_VALUE.test(raw)) continue;
    if (key === "vid" && !/^rv_[a-f0-9]{16}$/.test(raw)) continue;
    result[key] = raw;
  }
  return result;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getStripeApiKey(): Promise<string> {
  const env = Deno.env.get("STRIPE_API_KEY");
  if (env) return assertStripeKeyMode(env);

  const { data, error } = await admin.rpc("get_stripe_api_key");
  if (!error && typeof data === "string" && data.length > 0) return assertStripeKeyMode(data);

  throw new Error("stripe_api_key_missing");
}

function assertStripeKeyMode(key: string): string {
  key = key.trim();
  const mode = /^(sk|rk)_live_/.test(key) ? "live" : /^(sk|rk)_test_/.test(key) ? "test" : null;
  if (mode !== (PRODUCTION_BACKEND ? "live" : "test")) throw new Error("stripe_environment_mode_mismatch");
  return key;
}

async function authenticate(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("auth_required");
  const token = authHeader.slice("Bearer ".length);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user?.id || !user.email || !user.email_confirmed_at) throw new Error("auth_invalid");
  return user;
}

async function requireManager(userId: string, workspaceId: string) {
  const { data, error } = await admin
    .from("workspace_members")
    .select("role,status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error("membership_lookup_failed");
  if (!data || data.status !== "active" || (data.role !== "owner" && data.role !== "admin")) {
    throw new Error("billing_not_authorized");
  }
}

async function loadWorkspace(workspaceId: string) {
  const [{ data: workspace, error: workspaceError }, { data: subscription, error: subscriptionError }] =
    await Promise.all([
      admin.from("workspaces").select("id,name").eq("id", workspaceId).maybeSingle(),
      admin.from("subscriptions").select(
        "workspace_id,plan,status,trial_ends_at,billing_interval,billing_provider,external_customer_id,external_subscription_id"
      ).eq("workspace_id", workspaceId).maybeSingle(),
    ]);

  if (workspaceError || subscriptionError) throw new Error("billing_state_lookup_failed");
  if (!workspace || !subscription) throw new Error("billing_state_missing");

  return { workspace, subscription };
}

async function usedProfessionalSeats(workspaceId: string): Promise<number> {
  const { count, error } = await admin
    .from("workspace_members")
    .select("user_id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .in("role", ["owner", "admin", "professional"]);

  if (error) throw new Error("seat_usage_lookup_failed");
  return count ?? 0;
}

async function ensureCustomer(
  stripe: Stripe,
  workspaceId: string,
  workspaceName: string,
  email: string,
  externalCustomerId: string | null,
): Promise<string> {
  if (externalCustomerId) {
    const existing = await stripeRequest("customers_read", () => stripe.customers.retrieve(externalCustomerId));
    if ("deleted" in existing && existing.deleted) throw new Error("billing_customer_deleted");
    return existing.id;
  }

  const customer = await stripeRequest("customers_write", () => stripe.customers.create(
    {
      email,
      name: workspaceName,
      metadata: { app: "agende", workspace_id: workspaceId },
    },
    { idempotencyKey: `agende_customer_${workspaceId}` },
  ));

  const { error } = await admin.rpc("bind_billing_customer", {
    p_workspace_id: workspaceId,
    p_provider: "stripe",
    p_external_customer_id: customer.id,
  });
  if (error) throw new Error(`bind_billing_customer_failed:${error.message}`);

  return customer.id;
}

async function resolvePrice(stripe: Stripe, plan: Plan, interval: BillingInterval) {
  const expected = PRICE_CATALOG[plan][interval];
  const prices = await stripeRequest("prices_read", () => stripe.prices.list({
    active: true,
    lookup_keys: [expected.lookupKey],
    limit: 1,
  }));
  const price = prices.data[0];

  if (
    !price ||
    price.lookup_key !== expected.lookupKey ||
    price.currency !== "brl" ||
    price.unit_amount !== expected.amountCents ||
    price.recurring?.interval !== expected.stripeInterval ||
    price.recurring?.interval_count !== 1 || price.recurring?.usage_type !== "licensed"
  ) {
    throw new Error("stripe_catalog_mismatch");
  }

  return price;
}

function getStripe(options: { apiKey: string }) {
  return new Stripe(options.apiKey, {
    apiVersion: "2026-08-26.dahlia",
    timeout: 15000,
    maxNetworkRetries: 1,
    httpClient: Stripe.createFetchHttpClient(),
    appInfo: {
      name: "Agende",
      version: "0.1.0",
      url: SITE_URL,
    },
  });
}

async function createCheckout(args: {
  stripe: Stripe;
  workspaceId: string;
  workspaceName: string;
  email: string;
  plan: Plan;
  interval: BillingInterval;
  idempotencyKey?: string;
  subscription: Record<string, any>;
  attribution?: Record<string, string>;
}) {
  const expected = PRICE_CATALOG[args.plan][args.interval];
  const seats = await usedProfessionalSeats(args.workspaceId);
  if (seats > expected.maxProfessionals) throw new Error("plan_seat_limit_exceeded");

  const currentExternalSubscription = args.subscription.external_subscription_id;
  if (
    currentExternalSubscription &&
    args.subscription.status !== "canceled" &&
    args.subscription.status !== "expired"
  ) {
    throw new Error("subscription_already_exists");
  }

  const customerId = await ensureCustomer(
    args.stripe,
    args.workspaceId,
    args.workspaceName,
    args.email,
    args.subscription.external_customer_id,
  );
  const price = await resolvePrice(args.stripe, args.plan, args.interval);

  // The webhook may not have arrived yet. The Stripe customer is authoritative
  // for duplicate protection, including paused/incomplete subscriptions.
  for (const existing of await stripeItems("subscriptions_read", args.stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 }))) {
    if (existing.status !== "canceled" && existing.status !== "incomplete_expired") {
      throw new Error("subscription_already_exists");
    }
  }
  for (const existing of await stripeItems("checkout_sessions_read", args.stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 }))) {
    if (existing.mode !== "subscription" || existing.metadata?.app !== "agende") continue;
    if (existing.metadata.plan_code !== args.plan || existing.metadata.billing_interval !== args.interval) {
      // Invalidate the old payment link before offering a different selection.
      // If it was completed concurrently, Stripe rejects expiration and we stop.
      await stripeRequest("checkout_sessions_write", () => args.stripe.checkout.sessions.expire(existing.id));
      continue;
    }
    if (existing.url) return existing.url;
  }

  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
    billing_mode: { type: "flexible" },
    metadata: {
      ...args.attribution,
      app: "agende",
      workspace_id: args.workspaceId,
      plan_code: args.plan,
      billing_interval: args.interval,
      manager_email: args.email,
    },
  };

  if (args.subscription.status === "trialing" && args.subscription.trial_ends_at) {
    const trialEndSeconds = Math.floor(new Date(args.subscription.trial_ends_at).getTime() / 1000);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const remainingSeconds = trialEndSeconds - nowSeconds;

    if (remainingSeconds >= 48 * 60 * 60) {
      subscriptionData.trial_end = trialEndSeconds;
      subscriptionData.trial_settings = {
        end_behavior: { missing_payment_method: "cancel" },
      };
    } else if (remainingSeconds >= 5 * 60) {
      subscriptionData.billing_cycle_anchor = trialEndSeconds;
      subscriptionData.proration_behavior = "none";
    } else if (remainingSeconds > 0) {
      throw new Error("trial_ending_soon");
    }
  }

  const session = await stripeRequest("checkout_sessions_write", () => args.stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${SITE_URL}/app/configuracoes/assinatura?checkout=success`,
      cancel_url: `${SITE_URL}/app/configuracoes/assinatura?checkout=cancelled`,
      client_reference_id: args.workspaceId,
      locale: "pt-BR",
      origin_context: "web",
      integration_identifier: "agende_checkout_xqplmnzr",
      payment_method_collection: "always",
      metadata: {
        ...args.attribution,
        app: "agende",
        workspace_id: args.workspaceId,
        plan_code: args.plan,
        billing_interval: args.interval,
        manager_email: args.email,
      },
      subscription_data: subscriptionData,
    },
    {
      idempotencyKey:
        args.idempotencyKey && args.idempotencyKey.length >= 16 && args.idempotencyKey.length <= 100
          ? `agende_${args.workspaceId}_${args.plan}_${args.interval}_${args.idempotencyKey}`
          : `agende_checkout_${args.workspaceId}_${args.plan}_${args.interval}_${crypto.randomUUID()}`,
    },
  ));

  if (!session.url) throw new Error("checkout_url_missing");
  return session.url;
}

async function createPortal(stripe: Stripe, externalCustomerId: string | null) {
  if (!externalCustomerId) throw new Error("billing_customer_missing");
  const customer = await stripe.customers.retrieve(externalCustomerId);
  if ("deleted" in customer && customer.deleted) throw new Error("billing_customer_deleted");

  const session = await stripeRequest("customer_portal_write", () => stripe.billingPortal.sessions.create({
    customer: externalCustomerId,
    return_url: `${SITE_URL}/app/configuracoes/assinatura`,
  }));

  return session.url;
}

// ---- Self-service on an existing subscription (no Portal) ----
// Switch monthly -> annual on the same plan, and cancel at period end (or undo it).
// Plan changes and annual -> monthly are not offered here.
const MANAGEABLE_STATUSES = new Set(["trialing", "active"]);

function stringId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") return (value as { id: string }).id;
  return null;
}

async function loadManagedSubscription(stripe: Stripe, subscription: Record<string, any>) {
  const id = subscription.external_subscription_id;
  if (subscription.billing_provider !== "stripe" || !id) throw new Error("subscription_missing");
  const current = await stripeRequest("subscriptions_read", () => stripe.subscriptions.retrieve(id));
  if (current.metadata?.app && current.metadata.app !== "agende") throw new Error("subscription_missing");
  const items = current.items?.data ?? [];
  if (items.length !== 1) throw new Error("subscription_unsupported");
  return { current, item: items[0] };
}

function subscriptionInterval(item: Stripe.SubscriptionItem): BillingInterval | null {
  const recurring = item.price?.recurring;
  if (recurring?.interval_count !== 1) return null;
  return recurring.interval === "month" ? "monthly" : recurring.interval === "year" ? "annual" : null;
}

function subscriptionPlan(current: Stripe.Subscription, item: Stripe.SubscriptionItem): Plan | null {
  const key = item.price?.lookup_key ?? "";
  for (const plan of Object.keys(PRICE_CATALOG) as Plan[]) {
    if (PRICE_CATALOG[plan].monthly.lookupKey === key || PRICE_CATALOG[plan].annual.lookupKey === key) return plan;
  }
  // Prices replaced by a newer one lose their lookup_key; the subscription metadata keeps the plan.
  return parsePlan(current.metadata?.plan_code);
}

function toIsoSeconds(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000).toISOString() : null;
}

function subscriptionState(current: Stripe.Subscription, item: Stripe.SubscriptionItem) {
  const interval = subscriptionInterval(item);
  const plan = subscriptionPlan(current, item);
  const manageable = MANAGEABLE_STATUSES.has(current.status);
  const scheduled = Boolean(current.cancel_at_period_end || current.cancel_at);
  return {
    status: current.status,
    plan,
    interval,
    trialEnd: current.status === "trialing" ? toIsoSeconds(current.trial_end) : null,
    currentPeriodEnd: toIsoSeconds(item.current_period_end),
    cancelScheduled: scheduled,
    cancelAt: current.cancel_at ? toIsoSeconds(current.cancel_at) : scheduled ? toIsoSeconds(item.current_period_end) : null,
    canSwitchToAnnual: manageable && interval === "monthly" && Boolean(plan) && !scheduled,
    canCancel: manageable && !scheduled,
    canResume: manageable && Boolean(current.cancel_at_period_end),
  };
}

function annualSwitchParams(current: Stripe.Subscription, item: Stripe.SubscriptionItem, annualPriceId: string) {
  const trialing = current.status === "trialing";
  // Trial: nothing is charged now; the annual price applies when the trial ends.
  // Active monthly: Stripe credits the unused part of the month and charges the year
  // now, prorated up to the subscription anniversary (flexible billing keeps the
  // anchor day; billing_cycle_anchor cannot be forced on this update).
  return {
    items: [{ id: item.id, price: annualPriceId, quantity: 1 }],
    proration_behavior: trialing ? "none" as const : "always_invoice" as const,
  };
}

async function previewAnnualSwitch(stripe: Stripe, subscription: Record<string, any>) {
  const { current, item } = await loadManagedSubscription(stripe, subscription);
  const state = subscriptionState(current, item);
  if (!state.canSwitchToAnnual || !state.plan) throw new Error("switch_unavailable");
  const annual = await resolvePrice(stripe, state.plan, "annual");
  const annualAmount = annual.unit_amount ?? 0;
  if (current.status === "trialing") {
    return { plan: state.plan, amountDueCents: 0, annualAmountCents: annualAmount, yearChargeCents: 0, creditCents: 0,
      chargesAt: state.trialEnd, renewsAt: null };
  }
  const preview = await stripeRequest("invoices_read", () => stripe.invoices.createPreview({
    customer: stringId(current.customer)!,
    subscription: current.id,
    subscription_details: annualSwitchParams(current, item, annual.id),
  }));
  const lines = preview.lines?.data ?? [];
  const credit = lines.filter((line) => line.amount < 0).reduce((sum, line) => sum - line.amount, 0);
  const yearCharge = lines.filter((line) => line.amount > 0).reduce((sum, line) => sum + line.amount, 0);
  const renewsAt = lines.filter((line) => line.amount > 0).reduce((max, line) => Math.max(max, line.period?.end ?? 0), 0);
  return {
    plan: state.plan,
    amountDueCents: Math.max(0, preview.amount_due ?? 0),
    annualAmountCents: annualAmount,
    yearChargeCents: yearCharge,
    creditCents: credit,
    chargesAt: null,
    renewsAt: toIsoSeconds(renewsAt || null),
  };
}

async function switchToAnnual(stripe: Stripe, subscription: Record<string, any>, idempotencyKey: string) {
  const { current, item } = await loadManagedSubscription(stripe, subscription);
  const state = subscriptionState(current, item);
  if (!state.canSwitchToAnnual || !state.plan) throw new Error("switch_unavailable");
  const annual = await resolvePrice(stripe, state.plan, "annual");
  const updated = await stripeRequest("subscriptions_write", () => stripe.subscriptions.update(current.id, {
    ...annualSwitchParams(current, item, annual.id),
    // A declined card leaves the subscription monthly instead of half-switched.
    payment_behavior: "error_if_incomplete",
    metadata: { billing_interval: "annual", plan_code: state.plan! },
  }, { idempotencyKey: `agende_switch_annual_${current.id}_${idempotencyKey}` }));
  return subscriptionState(updated, updated.items.data[0]);
}

async function setCancelAtPeriodEnd(stripe: Stripe, subscription: Record<string, any>, cancel: boolean) {
  const { current, item } = await loadManagedSubscription(stripe, subscription);
  const state = subscriptionState(current, item);
  if (cancel ? !state.canCancel : !state.canResume) throw new Error(cancel ? "cancel_unavailable" : "resume_unavailable");
  // Ends with the paid period (or the trial): no refund and no new charge.
  const updated = await stripeRequest("subscriptions_write", () => stripe.subscriptions.update(current.id, {
    cancel_at_period_end: cancel,
  }));
  return subscriptionState(updated, updated.items.data[0]);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "access-control-allow-origin": SITE_URL,
        "access-control-allow-headers": "authorization, apikey, content-type",
        "access-control-allow-methods": "POST, OPTIONS",
      },
    });
  }

  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  try {
    const user = await authenticate(req);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { error: "invalid_request" });

    const workspaceId = isUuid(body.workspaceId) ? body.workspaceId : null;
    if (!workspaceId) return json(400, { error: "workspace_invalid" });

    await requireManager(user.id, workspaceId);
    const { workspace, subscription } = await loadWorkspace(workspaceId);
    const stripe = getStripe({ apiKey: await getStripeApiKey() });

    if (body.action === "checkout") {
      const plan = parsePlan(body.plan);
      const interval = parseInterval(body.billingInterval);
      if (!plan || !interval) return json(400, { error: "billing_selection_invalid" });
      if (interval === "annual" && !ANNUAL_CHECKOUT_ENABLED) return json(400, { error: "annual_unavailable" });

      const leaseToken = crypto.randomUUID();
      const { data: acquired, error: leaseError } = await admin.rpc("acquire_stripe_checkout", {
        p_workspace_id: workspaceId, p_token: leaseToken,
      });
      if (leaseError) throw new Error("billing_unavailable");
      if (!acquired) throw new Error("checkout_in_progress");
      try {
        const url = await createCheckout({
          stripe,
          workspaceId,
          workspaceName: workspace.name,
          email: user.email!,
          plan,
          interval,
          idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
          subscription,
          attribution: parseAttribution(body.attribution),
        });
        return json(200, { url });
      } finally {
        await admin.rpc("release_stripe_checkout", { p_workspace_id: workspaceId, p_token: leaseToken });
      }
    }

    if (body.action === "portal") {
      const url = await createPortal(stripe, subscription.external_customer_id);
      return json(200, { url });
    }

    if (body.action === "status") {
      if (!subscription.external_subscription_id) return json(200, { subscription: null });
      const { current, item } = await loadManagedSubscription(stripe, subscription);
      return json(200, { subscription: subscriptionState(current, item) });
    }

    if (body.action === "preview_annual") {
      return json(200, { preview: await previewAnnualSwitch(stripe, subscription) });
    }

    if (body.action === "switch_annual") {
      const key = typeof body.idempotencyKey === "string" && /^[A-Za-z0-9-]{16,100}$/.test(body.idempotencyKey) ? body.idempotencyKey : null;
      if (!key) return json(400, { error: "invalid_request" });
      return json(200, { subscription: await switchToAnnual(stripe, subscription, key) });
    }

    if (body.action === "cancel" || body.action === "resume") {
      return json(200, { subscription: await setCancelAtPeriodEnd(stripe, subscription, body.action === "cancel") });
    }

    return json(400, { error: "billing_action_invalid" });
  } catch (error) {
    if (error instanceof StripeOperationError) {
      return json(error.reason === "permission_missing" ? 403 : 502, {
        error: "stripe_operation_failed", operation: error.operation, reason: error.reason,
        ...(error.parameter ? { parameter: error.parameter } : {}),
        ...(error.providerType ? { provider_type: error.providerType } : {}),
        ...(error.providerStatus ? { provider_status: error.providerStatus } : {}),
        ...(error.hint ? { hint: error.hint } : {}),
      });
    }
    const message = error instanceof Error ? error.message : "billing_error";
    const known = [
      "auth_required",
      "auth_invalid",
      "billing_not_authorized",
      "plan_seat_limit_exceeded",
      "subscription_already_exists",
      "billing_customer_missing",
      "billing_customer_deleted",
      "stripe_api_key_missing",
      "stripe_catalog_mismatch",
      "trial_ending_soon",
      "checkout_in_progress",
      "subscription_missing",
      "subscription_unsupported",
      "switch_unavailable",
      "cancel_unavailable",
      "resume_unavailable",
      "payment_declined",
    ];
    const status =
      message === "auth_required" || message === "auth_invalid" ? 401 :
      message === "billing_not_authorized" ? 403 :
      message === "stripe_api_key_missing" ? 503 :
      known.includes(message) ? 409 :
      500;

    // Provider/database errors can include credentials or customer data.
    if (status === 500) console.error("stripe_billing_failed");
    return json(status, { error: known.includes(message) ? message : "billing_unavailable" });
  }
});
