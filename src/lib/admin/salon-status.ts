export const SALON_FILTERS = [
  { value: "", label: "Todos" }, { value: "trial", label: "Em teste" },
  { value: "paid", label: "Pagando" }, { value: "delinquent", label: "Inadimplentes" },
  { value: "trial_expired", label: "Teste expirado" }, { value: "canceled", label: "Cancelados" },
  { value: "none", label: "Sem assinatura" }, { value: "unverified", label: "Não verificados" },
] as const;

export const SALON_STATUS = {
  trial: "Trial ativo", paid: "Assinatura paga ativa", past_due: "Pagamento em atraso (past_due)",
  unpaid: "Assinatura não paga (unpaid)", cancel_scheduled: "Cancelamento agendado",
  canceled: "Assinatura cancelada", trial_expired: "Trial expirado", none: "Sem assinatura",
  unverified: "Status não verificado",
} as const;
export type SalonStatus = keyof typeof SALON_STATUS;
export function salonStatus(value: unknown): SalonStatus {
  return typeof value === "string" && Object.hasOwn(SALON_STATUS, value) ? value as SalonStatus : "unverified";
}
export function trialDays(status: unknown, endsAt: string | null, asOf: string): number | null {
  if (status !== "trial" || !endsAt) return null;
  const remaining = Date.parse(endsAt) - Date.parse(asOf);
  return Number.isFinite(remaining) && remaining > 0 ? Math.ceil(remaining / 86_400_000) : null;
}
export function nextPeriodLabel(status: SalonStatus): string {
  return status === "past_due" || status === "unpaid" ? "Fim do período registrado" : "Fim do período / possível renovação";
}
