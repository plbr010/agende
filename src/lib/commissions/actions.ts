"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/auth/actions";
import { requireConfirmedSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseReaisToCents } from "@/lib/validation/money";
import { percentToBps } from "@/lib/commissions/queries";

function mapCommissionError(message: string): string {
  if (message.includes("not_authorized") || message.includes("42501") || message.includes("owner_permissions_locked")) {
    return "Você não pode fazer esta alteração.";
  }
  if (message.includes("commission_exceeds_released")) {
    return "O pagamento passa do valor liberado.";
  }
  if (message.includes("commission_recovery_exceeds_paid")) {
    return "A devolução passa do que já foi pago.";
  }
  if (message.includes("invalid_commission_adjustment")) {
    return "O ajuste precisa de um motivo e não pode aumentar a comissão.";
  }
  if (message.includes("invalid_commission_payment") || message.includes("invalid_idempotency_key")) {
    return "Confira o valor, a data e a observação. A observação fica em branco ou tem pelo menos 3 caracteres.";
  }
  if (message.includes("invalid_permission")) {
    return "Essa permissão não existe.";
  }
  if (message.includes("idempotency_key_conflict")) {
    return "Esta confirmação já foi usada em outro lançamento.";
  }
  return "Não foi possível salvar. Tente de novo.";
}

async function workspaceId() {
  const session = await requireConfirmedSession("/app");
  return session.workspaces[0]?.id ?? null;
}

function revalidateCommissionScreens() {
  revalidatePath("/app/comissoes");
  revalidatePath("/app/configuracoes/comissoes");
  revalidatePath("/app/configuracoes/permissoes");
  revalidatePath("/app/financeiro");
  revalidatePath("/app/relatorios");
}

export async function saveCommissionRuleAction(formData: FormData): Promise<ActionState> {
  const workspace = await workspaceId();
  const professionalId = String(formData.get("professionalId") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const rate = percentToBps(String(formData.get("rate") ?? ""));
  if (!workspace || !z.string().uuid().safeParse(professionalId).success || rate == null) {
    return { error: "Informe um percentual de 0 a 100." };
  }
  if (serviceId && !z.string().uuid().safeParse(serviceId).success) {
    return { error: "Escolha o serviço de novo." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_commission_rule", {
    p_workspace_id: workspace,
    p_professional_member_id: professionalId,
    p_service_id: serviceId || null,
    p_rate_bps: rate,
  });
  if (error) return { error: mapCommissionError(error.message) };
  revalidateCommissionScreens();
  return { success: "Percentual salvo. Atendimentos já concluídos não mudam." };
}

export async function saveCommissionPolicyAction(formData: FormData): Promise<ActionState> {
  const workspace = await workspaceId();
  const policy = String(formData.get("policy") ?? "");
  if (!workspace || (policy !== "on_receipt" && policy !== "on_completion")) {
    return { error: "Escolha quando a comissão pode ser paga." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_commission_release_policy", {
    p_workspace_id: workspace,
    p_policy: policy,
  });
  if (error) return { error: mapCommissionError(error.message) };
  revalidateCommissionScreens();
  return { success: "A opção vale para os próximos atendimentos." };
}

export async function payCommissionAction(formData: FormData): Promise<ActionState> {
  const commissionId = String(formData.get("commissionId") ?? "");
  const amount = parseReaisToCents(String(formData.get("amount") ?? ""));
  const paidOn = String(formData.get("paidOn") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const key = String(formData.get("idempotencyKey") ?? "");
  const direction = String(formData.get("direction") ?? "payout");
  if (direction !== "payout" && direction !== "recovery") return { error: "Operação inválida." };
  if (direction === "recovery" && note.length < 3) return { error: "Informe o motivo da devolução recebida." };
  if (!z.string().uuid().safeParse(commissionId).success || amount == null || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || key.length < 8) {
    return { error: "Informe o valor e a data do pagamento." };
  }
  if (note && (note.length < 3 || note.length > 200)) {
    return { error: "A observação fica em branco ou tem entre 3 e 200 caracteres." };
  }
  const supabase = await createClient();
  const args = {
    p_commission_id: commissionId,
    p_amount_cents: amount,
    p_paid_on: paidOn,
    p_note: note || null,
    p_idempotency_key: key,
  };
  const { error } = direction === "recovery"
    ? await supabase.rpc("recover_commission", args)
    : await supabase.rpc("pay_commission", args);
  if (error) return { error: mapCommissionError(error.message) };
  revalidateCommissionScreens();
  return { success: direction === "recovery" ? "Devolução registrada." : "Pagamento registrado." };
}

export async function adjustCommissionAction(formData: FormData): Promise<ActionState> {
  const commissionId = String(formData.get("commissionId") ?? "");
  const amount = parseReaisToCents(String(formData.get("amount") ?? ""));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!z.string().uuid().safeParse(commissionId).success || amount == null || reason.length < 3) {
    return { error: "Informe o novo valor e um motivo." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_commission", {
    p_commission_id: commissionId,
    p_new_amount_cents: amount,
    p_reason: reason,
  });
  if (error) return { error: mapCommissionError(error.message) };
  revalidateCommissionScreens();
  return { success: "Ajuste registrado. O histórico foi mantido." };
}

export async function setMemberPermissionAction(formData: FormData): Promise<ActionState> {
  const memberId = String(formData.get("memberId") ?? "");
  const key = String(formData.get("permissionKey") ?? "");
  const effect = String(formData.get("effect") ?? "");
  if (!z.string().uuid().safeParse(memberId).success || !key) {
    return { error: "Não foi possível identificar a pessoa." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_permission", {
    p_member_id: memberId,
    p_permission_key: key,
    p_effect: effect === "grant" || effect === "deny" ? effect : null,
  });
  if (error) return { error: mapCommissionError(error.message) };
  revalidateCommissionScreens();
  revalidatePath("/app");
  return { success: effect === "deny" ? "Acesso bloqueado." : effect === "grant" ? "Acesso liberado." : "Voltou ao padrão do cargo." };
}
