import { z } from "zod";
export const planSchema = z.enum(["solo", "equipe", "salao"]);
export type PlanId = z.infer<typeof planSchema>;
export const TRIAL_COPY =
  "Por 7 dias você usa tudo do plano escolhido. Não pedimos cartão. Trocar de plano no teste não zera os 7 dias.";
export function trialDaysRemaining(endsAt: string | null | undefined, now = Date.now()) {
  return endsAt ? Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 86400000)) : 0;
}

export function parsePlanId(value: unknown): PlanId | null {
  const parsed = planSchema.safeParse(typeof value === "string" ? value.trim().toLowerCase() : value);
  return parsed.success ? parsed.data : null;
}

export function planSignupHref(plan: PlanId): string {
  return `/cadastro?plan=${plan}`;
}
