
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
    monthly: { lookupKey: "agende_solo_monthly", amountCents: 8990, stripeInterval: "month", maxProfessionals: 1 },
    annual: { lookupKey: "agende_solo_annual", amountCents: 79900, stripeInterval: "year", maxProfessionals: 1 },
  },
  equipe: {
    monthly: { lookupKey: "agende_equipe_monthly", amountCents: 16990, stripeInterval: "month", maxProfessionals: 5 },
    annual: { lookupKey: "agende_equipe_annual", amountCents: 149900, stripeInterval: "year", maxProfessionals: 5 },
  },
  salao: {
    monthly: { lookupKey: "agende_salao_monthly", amountCents: 29990, stripeInterval: "month", maxProfessionals: 15 },
    annual: { lookupKey: "agende_salao_annual", amountCents: 279900, stripeInterval: "year", maxProfessionals: 15 },
  },
};

const SITE_URL = (Deno.env.get("AGENDE_SITE_URL") ?? "https://agende-lac.vercel.app").replace(/\/$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

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
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

const ADMIN_KEY = getAdminKey();
if (!SUPABASE_URL || !ADMIN_KEY) throw new Error("supabase_runtime_env_missing");

const admin = createClient(SUPABASE_URL, ADMIN_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getStripeApiKey(): Promise<string> {
  const env = Deno.env.get("STRIPE_API_KEY");
  if (env) return env;

  const { data, error } = await admin.rpc("get_stripe_api_key");
  if (!error && typeof data === "string" && data.length > 0) return data;

  throw new Error("stripe_api_key_missing");
}

async function authenticate(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("auth_required");
  const token = authHeader.slice("Bearer ".length);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user?.id || !user.email) throw new Error("auth_invalid");
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
    const existing = await stripe.customers.retrieve(externalCustomerId);
    if ("deleted" in existing && existing.deleted) throw new Error("billing_customer_deleted");
    return existing.id;
  }

  const customer = await stripe.customers.create(
    {
      email,
      name: workspaceName,
      metadata: { app: "agende", workspace_id: workspaceId },
    },
    { idempotencyKey: `agende_customer_${workspaceId}` },
  );

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
  const prices = await stripe.prices.list({
    active: true,
    lookup_keys: [expected.lookupKey],
    limit: 1,
  });
  const price = prices.data[0];

  if (
    !price ||
    price.lookup_key !== expected.lookupKey ||
    price.currency !== "brl" ||
    price.unit_amount !== expected.amountCents ||
    price.recurring?.interval !== expected.stripeInterval
  ) {
    throw new Error("stripe_catalog_mismatch");
  }

  return price;
}

function getStripe(options: { apiKey: string }) {
  return new Stripe(options.apiKey, {
    apiVersion: "2026-08-26.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
    appInfo: {
      name: "Agendê",
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

  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
    billing_mode: { type: "flexible" },
    metadata: {
      app: "agende",
      workspace_id: args.workspaceId,
      plan_code: args.plan,
      billing_interval: args.interval,
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
    }
  }

  const session = await args.stripe.checkout.sessions.create(
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
        app: "agende",
        workspace_id: args.workspaceId,
        plan_code: args.plan,
        billing_interval: args.interval,
      },
      subscription_data: subscriptionData,
    },
    {
      idempotencyKey:
        args.idempotencyKey && args.idempotencyKey.length >= 16 && args.idempotencyKey.length <= 200
          ? args.idempotencyKey
          : `agende_checkout_${args.workspaceId}_${args.plan}_${args.interval}_${crypto.randomUUID()}`,
    },
  );

  if (!session.url) throw new Error("checkout_url_missing");
  return session.url;
}

async function createPortal(stripe: Stripe, externalCustomerId: string | null) {
  if (!externalCustomerId) throw new Error("billing_customer_missing");
  const customer = await stripe.customers.retrieve(externalCustomerId);
  if ("deleted" in customer && customer.deleted) throw new Error("billing_customer_deleted");

  const session = await stripe.billingPortal.sessions.create({
    customer: externalCustomerId,
    return_url: `${SITE_URL}/app/configuracoes/assinatura`,
  });

  return session.url;
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

      const url = await createCheckout({
        stripe,
        workspaceId,
        workspaceName: workspace.name,
        email: user.email!,
        plan,
        interval,
        idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
        subscription,
      });
      return json(200, { url });
    }

    if (body.action === "portal") {
      const url = await createPortal(stripe, subscription.external_customer_id);
      return json(200, { url });
    }

    return json(400, { error: "billing_action_invalid" });
  } catch (error) {
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
    ];
    const status =
      message === "auth_required" || message === "auth_invalid" ? 401 :
      message === "billing_not_authorized" ? 403 :
      message === "stripe_api_key_missing" ? 503 :
      known.includes(message) ? 409 :
      500;

    if (status === 500) console.error("stripe_billing_failed", message);
    return json(status, { error: known.includes(message) ? message : "billing_unavailable" });
  }
});
