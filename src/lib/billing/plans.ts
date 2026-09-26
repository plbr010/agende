import { z } from "zod";
export const planSchema = z.enum(["solo", "equipe", "salao"]);
export const TRIAL_COPY = "Teste todos os recursos do plano por 7 dias. Sem cartão. Você poderá trocar de plano durante o teste sem reiniciar os 7 dias.";
export function trialDaysRemaining(endsAt: string | null | undefined, now = Date.now()) {
  return endsAt ? Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 86400000)) : 0;
}
