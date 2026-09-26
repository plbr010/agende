
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("supabase_runtime_env_missing");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PRICE_MAP: Record<string, { plan: "solo" | "equipe" | "salao"; interval: "monthly" | "annual" }> = {
  "price_1UIyLoKii3CCJXtckWStrnuQ": { plan: "solo", interval: "monthly" },
  "price_1UJogVKii3CCJXtcWCZ22oO2": { plan: "solo", interval: "annual" },
  "price_1UIyO6Kii3CCJXtcWlOr85tW": { plan: "equipe", interval: "monthly" },
  "price_1UJogkKii3CCJXtczVBirqG2": { plan: "equipe", interval: "annual" },
  "price_1UIyPDKii3CCJXtcQhJK0sHo": { plan: "salao", interval: "monthly" },
  "price_1UJognKii3CCJXtcCwqEgJMv": { plan: "salao", interval: "annual" },
};

const LOOKUP_MAP: Record<string, { plan: "solo" | "equipe" | "salao"; interval: "monthly" | "annual" }> = {
  agende_solo_monthly: { plan: "solo", interval: "monthly" },
  agende_solo_annual: { plan: "solo", interval: "annual" },
  agende_equipe_monthly: { plan: "equipe", interval: "monthly" },
  agende_equipe_annual: { plan: "equipe", interval: "annual" },
  agende_salao_monthly: { plan: "salao", interval: "monthly" },
  agende_salao_annual: { plan: "salao", interval: "annual" },
};

const encoder = new TextEncoder();

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function toIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function stringId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return null;
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  const pieces = signatureHeader.split(",").map((part) => part.trim());
  const timestampPart = pieces.find((part) => part.startsWith("t="));
  const signatures = pieces.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestampPart || signatures.length === 0) return false;

  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestamp)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) return false;

  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return signatures.some((candidate) => safeEqualHex(candidate, expected));
}

async function getWebhookSecret(): Promise<string> {
  const { data, error } = await supabase.rpc("get_stripe_webhook_secret");
  if (error || typeof data !== "string" || data.length === 0) {
    throw new Error("stripe_webhook_secret_unavailable");
  }
  return data;
}

function mapPlanIntervalFromMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return null;
  const plan = metadata.plan_code;
  const interval = metadata.billing_interval;
  if (
    (plan === "solo" || plan === "equipe" || plan === "salao") &&
    (interval === "monthly" || interval === "annual")
  ) {
    return { plan, interval };
  }
  return null;
}

function mapPlanIntervalFromSubscription(subscription: Record<string, any>) {
  const item = subscription.items?.data?.[0];
  if (!item || subscription.items?.data?.length !== 1) return null;
  const price = item.price;
  const priceId = stringId(price);
  if (priceId && PRICE_MAP[priceId]) return { ...PRICE_MAP[priceId], item };
  const lookupKey = price && typeof price === "object" ? price.lookup_key : null;
  if (typeof lookupKey === "string" && LOOKUP_MAP[lookupKey]) return { ...LOOKUP_MAP[lookupKey], item };
  return null;
}

function mapStripeStatus(status: unknown): "trialing" | "active" | "past_due" | "expired" | "canceled" {
  switch (status) {
    case "trialing": return "trialing";
    case "active": return "active";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "canceled":
      return "canceled";
    case "paused":
    case "incomplete_expired":
    default:
      return "expired";
  }
}

async function recordBillingEvent(args: {
  workspaceId: string;
  eventId: string;
  eventType: string;
  amountCents?: number | null;
  currency?: string | null;
  interval?: "monthly" | "annual" | null;
  status?: string | null;
  occurredAt: string;
}) {
  const { error } = await supabase.rpc("record_billing_event", {
    p_workspace_id: args.workspaceId,
    p_provider: "stripe",
    p_external_event_id: args.eventId,
    p_event_type: args.eventType,
    p_amount_cents: args.amountCents ?? null,
    p_currency: (args.currency ?? "BRL").toUpperCase(),
    p_billing_interval: args.interval ?? null,
    p_event_status: args.status ?? null,
    p_occurred_at: args.occurredAt,
  });
  if (error) throw new Error(`record_billing_event_failed:${error.message}`);
}

async function handleCheckout(event: Record<string, any>, session: Record<string, any>) {
  if (session.mode !== "subscription") return;
  if (session.metadata?.app !== "agende") return;

  const workspaceId = typeof session.client_reference_id === "string" ? session.client_reference_id : null;
  const payerEmail =
    typeof session.customer_details?.email === "string"
      ? session.customer_details.email
      : typeof session.customer_email === "string"
        ? session.customer_email
        : null;
  const customerId = stringId(session.customer);
  const subscriptionId = stringId(session.subscription);
  const planInterval = mapPlanIntervalFromMetadata(session.metadata);

  if (!workspaceId || !payerEmail || !customerId || !subscriptionId || !planInterval) {
    throw new Error("agende_checkout_binding_incomplete");
  }

  const { error } = await supabase.rpc("bind_stripe_checkout", {
    p_workspace_id: workspaceId,
    p_payer_email: payerEmail,
    p_external_customer_id: customerId,
    p_external_subscription_id: subscriptionId,
    p_plan: planInterval.plan,
    p_billing_interval: planInterval.interval,
    p_external_event_id: event.id,
    p_event_type: event.type,
    p_event_status: session.payment_status ?? session.status ?? null,
    p_occurred_at: toIso(event.created) ?? new Date().toISOString(),
  });
  if (error) throw new Error(`bind_stripe_checkout_failed:${error.message}`);
}

async function findSubscriptionBinding(externalSubscriptionId: string) {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "workspace_id, plan, status, billing_interval, external_customer_id, external_subscription_id, current_period_start, current_period_end, canceled_at",
    )
    .eq("billing_provider", "stripe")
    .eq("external_subscription_id", externalSubscriptionId)
    .maybeSingle();
  if (error) throw new Error(`subscription_lookup_failed:${error.message}`);
  return data;
}

async function handleSubscription(event: Record<string, any>, subscription: Record<string, any>) {
  if (subscription.metadata?.app && subscription.metadata.app !== "agende") return;

  const externalSubscriptionId = stringId(subscription.id);
  const externalCustomerId = stringId(subscription.customer);
  const planInterval = mapPlanIntervalFromSubscription(subscription) ??
    mapPlanIntervalFromMetadata(subscription.metadata);

  if (!externalSubscriptionId || !externalCustomerId || !planInterval) {
    if (subscription.metadata?.app === "agende") throw new Error("agende_subscription_payload_invalid");
    return;
  }

  const binding = await findSubscriptionBinding(externalSubscriptionId);
  if (!binding) {
    if (subscription.metadata?.app === "agende") throw new Error("agende_subscription_not_bound_yet");
    return;
  }

  const item = subscription.items?.data?.[0];
  const periodStart =
    toIso(item?.current_period_start) ??
    toIso(subscription.current_period_start);
  const periodEnd =
    toIso(item?.current_period_end) ??
    toIso(subscription.current_period_end);

  const mappedStatus = mapStripeStatus(subscription.status);
  const canceledAt = toIso(subscription.canceled_at);

  const { error } = await supabase.rpc("sync_billing_subscription", {
    p_workspace_id: binding.workspace_id,
    p_provider: "stripe",
    p_external_customer_id: externalCustomerId,
    p_external_subscription_id: externalSubscriptionId,
    p_plan: planInterval.plan,
    p_billing_interval: planInterval.interval,
    p_status: mappedStatus,
    p_current_period_start: periodStart,
    p_current_period_end: periodEnd,
    p_canceled_at: canceledAt,
  });
  if (error) throw new Error(`sync_billing_subscription_failed:${error.message}`);

  await recordBillingEvent({
    workspaceId: binding.workspace_id,
    eventId: event.id,
    eventType: event.type,
    interval: planInterval.interval,
    status: String(subscription.status ?? mappedStatus),
    occurredAt: toIso(event.created) ?? new Date().toISOString(),
  });
}

function invoiceSubscriptionId(invoice: Record<string, any>): string | null {
  return (
    stringId(invoice.subscription) ??
    stringId(invoice.parent?.subscription_details?.subscription) ??
    stringId(invoice.subscription_details?.subscription)
  );
}

async function handleInvoice(event: Record<string, any>, invoice: Record<string, any>) {
  const externalSubscriptionId = invoiceSubscriptionId(invoice);
  if (!externalSubscriptionId) return;

  const binding = await findSubscriptionBinding(externalSubscriptionId);
  if (!binding) return;

  await recordBillingEvent({
    workspaceId: binding.workspace_id,
    eventId: event.id,
    eventType: event.type,
    amountCents:
      typeof invoice.amount_paid === "number"
        ? invoice.amount_paid
        : typeof invoice.amount_due === "number"
          ? invoice.amount_due
          : null,
    currency: typeof invoice.currency === "string" ? invoice.currency : "BRL",
    interval: binding.billing_interval,
    status: typeof invoice.status === "string" ? invoice.status : null,
    occurredAt: toIso(event.created) ?? new Date().toISOString(),
  });

  if (
    (event.type === "invoice.paid" || event.type === "invoice.payment_failed") &&
    binding.external_customer_id &&
    binding.current_period_start &&
    binding.current_period_end
  ) {
    const nextStatus = event.type === "invoice.paid" ? "active" : "past_due";
    const { error } = await supabase.rpc("sync_billing_subscription", {
      p_workspace_id: binding.workspace_id,
      p_provider: "stripe",
      p_external_customer_id: binding.external_customer_id,
      p_external_subscription_id: externalSubscriptionId,
      p_plan: binding.plan,
      p_billing_interval: binding.billing_interval,
      p_status: nextStatus,
      p_current_period_start: binding.current_period_start,
      p_current_period_end: binding.current_period_end,
      p_canceled_at: null,
    });
    if (error) throw new Error(`invoice_status_sync_failed:${error.message}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return json(400, { error: "stripe_signature_missing" });

  const rawBody = await req.text();

  let secret: string;
  try {
    secret = await getWebhookSecret();
  } catch {
    return json(503, { error: "webhook_not_configured" });
  }

  if (!(await verifyStripeSignature(rawBody, signature, secret))) {
    return json(400, { error: "stripe_signature_invalid" });
  }

  let event: Record<string, any>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json(400, { error: "invalid_json" });
  }

  if (typeof event.id !== "string" || typeof event.type !== "string" || !event.data?.object) {
    return json(400, { error: "invalid_event" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckout(event, event.data.object);
        break;
      case "checkout.session.async_payment_failed": {
        const session = event.data.object;
        if (session.metadata?.app === "agende" && session.client_reference_id) {
          await recordBillingEvent({
            workspaceId: session.client_reference_id,
            eventId: event.id,
            eventType: event.type,
            status: session.payment_status ?? session.status ?? "failed",
            occurredAt: toIso(event.created) ?? new Date().toISOString(),
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscription(event, event.data.object);
        break;
      case "invoice.paid":
      case "invoice.payment_failed":
        await handleInvoice(event, event.data.object);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("stripe_webhook_processing_failed", event.id, event.type, error);
    return json(409, { error: "event_processing_deferred" });
  }

  return json(200, { received: true });
});
