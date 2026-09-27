export const PLAN_SEATS = { solo: 1, equipe: 5, salao: 15 } as const;

export function checkoutDisabledReason(plan: keyof typeof PLAN_SEATS, usedSeats: number | null,
  hasSubscription: boolean, status: string | undefined, canManage: boolean) {
  if (!canManage) return "Somente dono ou admin pode gerenciar a cobrança.";
  if (usedSeats === null || !Number.isFinite(usedSeats)) return "Não foi possível verificar os profissionais. Atualize a página.";
  if (usedSeats > PLAN_SEATS[plan]) return "Este plano não comporta seus profissionais ativos.";
  if (hasSubscription && status !== "canceled" && status !== "expired") return "Gerencie sua assinatura existente pelo Portal Stripe.";
  return null;
}

export function checkoutReturnMessage(value: unknown) {
  if (value === "success") return "Checkout concluído no Stripe. A confirmação da assinatura pode levar alguns instantes. Atualize os dados para acompanhar.";
  if (value === "cancelled") return "Checkout cancelado. Você pode escolher um plano e tentar novamente.";
  return null;
}
