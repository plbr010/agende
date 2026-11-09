import type { StripeBillingBackend } from "./stripe-contract";
import type { ManageBackend } from "./manage";

export type BillingInvoker = (name: string, options: { body: object }) => Promise<{
  data: unknown;
  error: { context?: unknown } | null;
}>;

async function invokeBilling(invoke: BillingInvoker, body: object) {
  const { data, error } = await invoke("stripe-billing", { body });
  if (error) {
    let code = "billing_unavailable";
    if (error.context instanceof Response) {
      const payload = await error.context.json().catch(() => null);
      if (typeof payload?.error === "string") code = payload.error;
    }
    throw new Error(code);
  }
  return data;
}

export function createEdgeBillingBackend(invoke: BillingInvoker): StripeBillingBackend {
  const request = (body: object) => invokeBilling(invoke, body);
  return {
    createCheckout: ({ workspaceId, plan, billingInterval, idempotencyKey, attribution }) =>
      request({ action: "checkout", workspaceId, plan, billingInterval, idempotencyKey, ...(attribution ? { attribution } : {}) }),
    createPortal: ({ workspaceId }) => request({ action: "portal", workspaceId }),
  };
}

/** Subscription self-service: status, switch to annual, cancel and resume. */
export function createEdgeManageBackend(invoke: BillingInvoker): ManageBackend {
  return (body) => invokeBilling(invoke, body);
}
