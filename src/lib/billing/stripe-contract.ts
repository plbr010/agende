import { z } from "zod";

export const billingPlanSchema = z.enum(["solo", "equipe", "salao"]);
export const billingIntervalSchema = z.enum(["monthly", "annual"]);

export const BILLING_INTERNAL_PATHS = {
  checkoutSuccess: "/app/configuracoes/assinatura?checkout=success",
  checkoutCancel: "/app/configuracoes/assinatura?checkout=cancelled",
  portalReturn: "/app/configuracoes/assinatura",
} as const;

export const createCheckoutInputSchema = z.object({
  workspaceId: z.string().min(1),
  plan: billingPlanSchema,
  billingInterval: billingIntervalSchema,
  idempotencyKey: z.string().trim().min(16).max(200),
});

export const createPortalInputSchema = z.object({
  workspaceId: z.string().min(1),
});

export const billingRedirectSchema = z.object({
  url: z.string().url().refine((value) => {
    const url = URL.parse(value);
    if (!url) return false;
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname);
  }, "stripe_redirect_not_allowed"),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutInputSchema>;
export type CreatePortalInput = z.infer<typeof createPortalInputSchema>;
export type StripeCheckoutCommand = CreateCheckoutInput & {
  successPath: typeof BILLING_INTERNAL_PATHS.checkoutSuccess;
  cancelPath: typeof BILLING_INTERNAL_PATHS.checkoutCancel;
};
export type StripePortalCommand = CreatePortalInput & {
  returnPath: typeof BILLING_INTERNAL_PATHS.portalReturn;
};

/**
 * Contrato da Edge Function. Segredos e resolução de preços ficam no backend.
 */
export interface StripeBillingBackend {
  createCheckout(input: StripeCheckoutCommand): Promise<unknown>;
  createPortal(input: StripePortalCommand): Promise<unknown>;
}

export function createStripeBillingQueries(backend: StripeBillingBackend) {
  return {
    async checkout(input: CreateCheckoutInput) {
      const safeInput = createCheckoutInputSchema.parse(input);
      return billingRedirectSchema.parse(await backend.createCheckout({
        ...safeInput,
        successPath: BILLING_INTERNAL_PATHS.checkoutSuccess,
        cancelPath: BILLING_INTERNAL_PATHS.checkoutCancel,
      }));
    },
    async portal(input: CreatePortalInput) {
      const safeInput = createPortalInputSchema.parse(input);
      return billingRedirectSchema.parse(await backend.createPortal({
        ...safeInput,
        returnPath: BILLING_INTERNAL_PATHS.portalReturn,
      }));
    },
  };
}

export const STRIPE_CAPABILITIES = {
  checkout: true,
  portal: true,
} as const;
