import { z } from "zod";
import { billingIntervalSchema, billingPlanSchema, createStripeBillingQueries, type StripeBillingBackend } from "./stripe-contract";

export const billingActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("checkout"), plan: billingPlanSchema, billingInterval: billingIntervalSchema,
    idempotencyKey: z.string().trim().min(16).max(100) }),
  z.object({ action: z.literal("portal") }),
]);
export type BillingActionInput = z.infer<typeof billingActionSchema>;
export type BillingActionResult = { url: string; error?: never } | { error: string; url?: never };

export function billingErrorMessage(code: string) {
  const messages: Record<string, string> = {
    billing_not_authorized: "Somente dono ou admin pode gerenciar a cobrança.",
    auth_required: "Entre novamente para gerenciar a cobrança.",
    auth_invalid: "Sua sessão expirou. Entre novamente.",
    plan_seat_limit_exceeded: "Este plano não comporta os profissionais ativos. Escolha um plano maior.",
    subscription_already_exists: "Já existe uma assinatura no Stripe. Gerencie-a pelo Portal ou atualize a página.",
    checkout_in_progress: "Já estamos preparando um checkout para este negócio. Aguarde alguns instantes e tente novamente.",
    trial_ending_soon: "Seu teste termina em poucos minutos. Aguarde o fim para assinar sem antecipar a cobrança.",
    billing_customer_missing: "Ainda não existe um cliente Stripe para este negócio.",
    billing_customer_deleted: "O cadastro de cobrança está indisponível. Entre em contato com o suporte.",
  };
  return messages[code] ?? "Não foi possível abrir a cobrança. Tente novamente em instantes.";
}

// The workspace comes only from the authenticated server session, never the form.
export async function runBillingAction(input: unknown, workspace: { id: string; role: string } | null,
  backend: StripeBillingBackend): Promise<BillingActionResult> {
  if (!workspace || !["owner", "admin"].includes(workspace.role)) {
    return { error: billingErrorMessage("billing_not_authorized") };
  }
  const parsed = billingActionSchema.safeParse(input);
  if (!parsed.success) return { error: "Selecione um plano e uma periodicidade válidos." };
  try {
    const billing = createStripeBillingQueries(backend);
    return parsed.data.action === "checkout"
      ? await billing.checkout({ ...parsed.data, workspaceId: workspace.id })
      : await billing.portal({ workspaceId: workspace.id });
  } catch (error) {
    return { error: billingErrorMessage(error instanceof Error ? error.message : "billing_unavailable") };
  }
}
