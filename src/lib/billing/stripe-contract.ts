import { z } from "zod";

export const billingPlanSchema = z.enum(["solo", "equipe", "salao"]);

const returnUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "invalid_return_protocol");

export const createCheckoutInputSchema = z.object({
  workspaceId: z.string().min(1),
  plan: billingPlanSchema,
  idempotencyKey: z.string().trim().min(16).max(200),
  successUrl: returnUrlSchema,
  cancelUrl: returnUrlSchema,
});

export const createPortalInputSchema = z.object({
  workspaceId: z.string().min(1),
  returnUrl: returnUrlSchema,
});

export const billingRedirectSchema = z.object({
  url: z.string().url().refine((value) => new URL(value).protocol === "https:", "stripe_redirect_must_use_https"),
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutInputSchema>;
export type CreatePortalInput = z.infer<typeof createPortalInputSchema>;

/**
 * Porta da futura integração Stripe. Não há implementação, segredo, checkout
 * ou chamada externa neste estágio.
 */
export interface StripeBillingBackend {
  createCheckout(input: CreateCheckoutInput): Promise<unknown>;
  createPortal(input: CreatePortalInput): Promise<unknown>;
}

export function createStripeBillingQueries(backend: StripeBillingBackend) {
  return {
    async checkout(input: CreateCheckoutInput) {
      const safeInput = createCheckoutInputSchema.parse(input);
      return billingRedirectSchema.parse(await backend.createCheckout(safeInput));
    },
    async portal(input: CreatePortalInput) {
      const safeInput = createPortalInputSchema.parse(input);
      return billingRedirectSchema.parse(await backend.createPortal(safeInput));
    },
  };
}

export const STRIPE_CAPABILITIES = {
  checkout: false,
  portal: false,
} as const;
