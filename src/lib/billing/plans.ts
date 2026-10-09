import { z } from "zod";
export const planSchema = z.enum(["solo", "equipe", "salao"]);
export type PlanId = z.infer<typeof planSchema>;
export const TRIAL_COPY = "Teste todos os recursos do plano por 7 dias. Sem cartão. Você poderá trocar de plano durante o teste sem reiniciar os 7 dias.";
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
