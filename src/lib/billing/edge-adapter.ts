import type { StripeBillingBackend } from "./stripe-contract";

export type BillingInvoker = (name: string, options: { body: object }) => Promise<{
  data: unknown;
  error: { context?: unknown } | null;
}>;

export function createEdgeBillingBackend(invoke: BillingInvoker): StripeBillingBackend {
  async function request(body: object) {
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
  return {
    createCheckout: ({ workspaceId, plan, billingInterval, idempotencyKey }) =>
      request({ action: "checkout", workspaceId, plan, billingInterval, idempotencyKey }),
    createPortal: ({ workspaceId }) => request({ action: "portal", workspaceId }),
  };
}
