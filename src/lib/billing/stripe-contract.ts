import { z } from "zod";

export const billingPlanSchema = z.enum(["solo", "equipe", "salao"]);
export const billingIntervalSchema = z.enum(["monthly", "annual"]);

export const BILLING_INTERNAL_PATHS = {
  checkoutSuccess: "/app/configuracoes/assinatura?checkout=success",
  checkoutCancel: "/app/configuracoes/assinatura?checkout=cancelled",
  portalReturn: "/app/configuracoes/assinatura",
} as const;

// Campaign attribution read server-side from first-party cookies, never from the
// form. It ends up in Stripe metadata (values capped at 500 chars; ours are ≤100).
const attributionValue = z.string().regex(/^[\p{L}\p{N} ._\-+|:/]{1,100}$/u);
export const checkoutAttributionSchema = z.object({
  vid: z.string().regex(/^rv_[a-f0-9]{16}$/).optional(),
  utm_source: attributionValue.optional(),
  utm_medium: attributionValue.optional(),
  utm_campaign: attributionValue.optional(),
  utm_content: attributionValue.optional(),
  utm_term: attributionValue.optional(),
  landing: attributionValue.optional(),
});
export type CheckoutAttribution = z.infer<typeof checkoutAttributionSchema>;

export const createCheckoutInputSchema = z.object({
  workspaceId: z.string().min(1),
  plan: billingPlanSchema,
  billingInterval: billingIntervalSchema,
  idempotencyKey: z.string().trim().min(16).max(100),
  // Attribution is best effort: a malformed value is dropped, never blocks the checkout.
  attribution: checkoutAttributionSchema.optional().catch(undefined),
});

export const createPortalInputSchema = z.object({
  workspaceId: z.string().min(1),
});

export const billingRedirectSchema = z.object({
  url: z.string().url().refine((value) => {
    // This schema also runs in the browser; URL.parse is not available in
    // older supported browsers. Keep invalid URLs fail-closed without throwing.
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && !url.port &&
        ["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname);
    } catch {
      return false;
    }
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
