import { z } from "zod";
export const planSchema = z.enum(["solo", "equipe", "salao"]);
export type PlanId = z.infer<typeof planSchema>;
export type BillingIntervalId = "monthly" | "annual";
// Annual prices of 2026-11-09: 12 months for the price of 10 monthly payments
// (R$ 399 / 799 / 1.499), charged upfront once the trial ends, renewing yearly.
export const ANNUAL_OFFER_ENABLED = true;
export const ANNUAL_SAVINGS_COPY = "Economize aproximadamente 16,7% no plano anual — equivalente a 2 meses grátis.";
export const ANNUAL_PREPAID_COPY =
  "No anual, o valor do ano é pago de uma vez, à vista, e renova automaticamente a cada 12 meses. Não é parcelado.";
export const TRIAL_COPY =
  "Por 7 dias você usa tudo do plano escolhido. Não pedimos cartão. Trocar de plano no teste não zera os 7 dias.";
export function trialDaysRemaining(endsAt: string | null | undefined, now = Date.now()) {
  return endsAt ? Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 86400000)) : 0;
}

export function parsePlanId(value: unknown): PlanId | null {
  const parsed = planSchema.safeParse(typeof value === "string" ? value.trim().toLowerCase() : value);
  return parsed.success ? parsed.data : null;
}

/** Accepts the public "anual"/"mensal" query values and the internal ids. */
export function parseBillingIntervalId(value: unknown): BillingIntervalId | null {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : null;
  if (normalized === "anual" || normalized === "annual") return "annual";
  if (normalized === "mensal" || normalized === "monthly") return "monthly";
  return null;
}

export function planSignupHref(plan: PlanId, interval: BillingIntervalId = "monthly"): string {
  return interval === "annual" ? `/cadastro?plan=${plan}&periodo=anual` : `/cadastro?plan=${plan}`;
}
