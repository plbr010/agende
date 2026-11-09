import { z } from "zod";
import { billingErrorMessage } from "./action-handler";
import { billingIntervalSchema, billingPlanSchema } from "./stripe-contract";

// Self-service on an existing Stripe subscription, without the Portal:
// monthly -> annual on the same plan, and cancel at period end (or undo it).
const isoOrNull = z.string().datetime({ offset: true }).nullable();

export const subscriptionStateSchema = z.object({
  status: z.string(),
  plan: billingPlanSchema.nullable(),
  interval: billingIntervalSchema.nullable(),
  trialEnd: isoOrNull,
  currentPeriodEnd: isoOrNull,
  cancelScheduled: z.boolean(),
  cancelAt: isoOrNull,
  canSwitchToAnnual: z.boolean(),
  canCancel: z.boolean(),
  canResume: z.boolean(),
});
export type SubscriptionState = z.infer<typeof subscriptionStateSchema>;

export const annualPreviewSchema = z.object({
  plan: billingPlanSchema,
  amountDueCents: z.number().int().min(0),
  annualAmountCents: z.number().int().min(0),
  yearChargeCents: z.number().int().min(0),
  creditCents: z.number().int().min(0),
  chargesAt: isoOrNull,
  renewsAt: isoOrNull,
});
export type AnnualPreview = z.infer<typeof annualPreviewSchema>;

export const manageActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preview_annual") }),
  z.object({ action: z.literal("switch_annual"), idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{16,100}$/) }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("resume") }),
]);
export type ManageActionInput = z.infer<typeof manageActionSchema>;
export type ManageActionResult =
  | { ok: true; preview?: AnnualPreview; subscription?: SubscriptionState }
  | { ok: false; error: string };

export type ManageBackend = (body: { action: string; workspaceId: string; idempotencyKey?: string }) => Promise<unknown>;

const MANAGE_ERRORS: Record<string, string> = {
  switch_unavailable: "A troca para o anual não está disponível para esta assinatura. Atualize a página.",
  cancel_unavailable: "Esta assinatura já está com o cancelamento agendado ou não pode ser cancelada.",
  resume_unavailable: "Não há cancelamento agendado para desfazer.",
  payment_declined: "O cartão recusou a cobrança do plano anual. Nada foi alterado: sua assinatura continua mensal. Atualize o cartão no Portal e tente de novo.",
  subscription_missing: "Não encontramos a assinatura no Stripe. Atualize a página.",
  subscription_unsupported: "Esta assinatura precisa ser alterada pelo suporte.",
};

export function manageErrorMessage(code: string) {
  return MANAGE_ERRORS[code] ?? billingErrorMessage(code).replace("abrir a cobrança", "alterar a assinatura");
}

export async function runManageAction(input: unknown, workspace: { id: string; role: string } | null,
  backend: ManageBackend): Promise<ManageActionResult> {
  if (!workspace || !["owner", "admin"].includes(workspace.role)) {
    return { ok: false, error: billingErrorMessage("billing_not_authorized") };
  }
  const parsed = manageActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Ação inválida." };
  try {
    const data = (await backend({ ...parsed.data, workspaceId: workspace.id })) as Record<string, unknown> | null;
    if (parsed.data.action === "preview_annual") {
      return { ok: true, preview: annualPreviewSchema.parse(data?.preview) };
    }
    return { ok: true, subscription: subscriptionStateSchema.parse(data?.subscription) };
  } catch (error) {
    return { ok: false, error: manageErrorMessage(error instanceof Error ? error.message : "billing_unavailable") };
  }
}

/** Reads the live Stripe state for the subscription page; null when unavailable. */
export async function loadSubscriptionState(workspaceId: string, backend: ManageBackend): Promise<SubscriptionState | null> {
  try {
    const data = (await backend({ action: "status", workspaceId })) as Record<string, unknown> | null;
    const parsed = subscriptionStateSchema.nullable().safeParse(data?.subscription ?? null);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
