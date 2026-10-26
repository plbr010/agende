"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireConfirmedSession } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import {
  parseAppointmentCreateForm,
  parseAppointmentRescheduleForm,
  parseAppointmentStatusForm,
  parseSlotQueryForm,
  parseTimeBlockForm,
  parseWorkingPeriodForm,
} from "@/lib/validation/agenda";
import {
  canManageJornada,
  canManageTimeBlocks,
  canWriteAppointment,
  loadAvailableSlots,
  loadCurrentMemberId,
} from "@/lib/agenda/queries";
import { canRescheduleStatus, isAppointmentStatus } from "@/lib/agenda/status";
import { loadWorkspaceSettings } from "@/lib/workspace/queries";
import { zonedWallTimeToUtc } from "@/lib/time/timezone";
import { parseReaisToCents } from "@/lib/validation/money";
import { checkoutMessage } from "@/lib/agenda/checkout-message";
import { mapAgendaError, slotQueryMessage } from "@/lib/agenda/errors";

export type SlotActionState = ActionState & {
  slots?: string[];
  localDate?: string;
  professionalMemberId?: string;
  serviceId?: string;
};

function fieldErrorsFromZod(error: { issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string }> }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function validationState(error: { issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string }> }): ActionState {
  const fieldErrors = fieldErrorsFromZod(error);
  const detail = fieldErrors.endTime ?? fieldErrors.startTime ?? fieldErrors.localDate ?? fieldErrors.label ?? fieldErrors.reason;
  return { error: detail ?? "Revise os horários.", fieldErrors };
}

function readRowId(formData: FormData): string | null {
  const id = String(formData.get("id") ?? "");
  return z.string().uuid().safeParse(id).success ? id : null;
}

async function requireWorkspace() {
  const session = await requireConfirmedSession("/app");
  const workspace = session.workspaces[0];
  if (!workspace) {
    return { error: "Nenhum negócio encontrado." as const, session, workspace: null };
  }
  return { error: null, session, workspace };
}

function revalidateAgenda() {
  revalidatePath("/app");
  revalidatePath("/app/agenda");
  revalidatePath("/app/equipe");
}

export async function createAppointmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseAppointmentCreateForm(formData);
  if (!parsed.success) {
    return { error: "Revise os campos destacados.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }

  const currentMemberId = await loadCurrentMemberId(workspace.id, session.user.id);
  const isOwn = currentMemberId === parsed.data.professionalMemberId;
  if (!canWriteAppointment(workspace.role, isOwn)) {
    return { error: "Você não pode criar este agendamento." };
  }

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("create_appointment", {
    p_workspace_id: workspace.id,
    p_client_id: parsed.data.clientId,
    p_professional_member_id: parsed.data.professionalMemberId,
    p_service_id: parsed.data.serviceId,
    p_starts_at: parsed.data.startsAt,
    p_notes: parsed.data.notes,
  });
  if (rpcError) {
    return { error: mapAgendaError(rpcError.message) };
  }

  revalidateAgenda();
  return { success: "Agendamento criado." };
}

export async function rescheduleAppointmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseAppointmentRescheduleForm(formData);
  if (!parsed.success) {
    return { error: "Revise os campos destacados.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("appointments")
    .select("id, professional_member_id, status")
    .eq("id", parsed.data.appointmentId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();

  if (!current) {
    return { error: "Agendamento não encontrado." };
  }
  if (!canRescheduleStatus(current.status)) {
    return { error: "Este agendamento não pode mais ser reagendado." };
  }

  const currentMemberId = await loadCurrentMemberId(workspace.id, session.user.id);
  const isOwn =
    currentMemberId === current.professional_member_id ||
    currentMemberId === parsed.data.professionalMemberId;
  if (!canWriteAppointment(workspace.role, isOwn)) {
    return { error: "Você não pode alterar este agendamento." };
  }

  const { error: rpcError } = await supabase.rpc("reschedule_appointment", {
    p_appointment_id: parsed.data.appointmentId,
    p_professional_member_id: parsed.data.professionalMemberId,
    p_service_id: parsed.data.serviceId,
    p_starts_at: parsed.data.startsAt,
    p_notes: parsed.data.notes,
  });
  if (rpcError) {
    return { error: mapAgendaError(rpcError.message) };
  }

  revalidateAgenda();
  return { success: "Agendamento atualizado." };
}

export async function setAppointmentStatusAction(formData: FormData): Promise<ActionState> {
  const parsed = parseAppointmentStatusForm(formData);
  if (!parsed.success) {
    return { error: "Não foi possível atualizar a situação deste horário." };
  }

  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  if (!isAppointmentStatus(parsed.data.status)) {
    return { error: "Não foi possível atualizar a situação deste horário." };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("appointments")
    .select("professional_member_id")
    .eq("id", parsed.data.appointmentId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (!current) {
    return { error: "Agendamento não encontrado." };
  }

  const currentMemberId = await loadCurrentMemberId(workspace.id, session.user.id);
  if (!canWriteAppointment(workspace.role, currentMemberId === current.professional_member_id)) {
    return { error: "Você não pode alterar este agendamento." };
  }

  const { error: rpcError } = await supabase.rpc("set_appointment_status", {
    p_appointment_id: parsed.data.appointmentId,
    p_status: parsed.data.status,
  });
  if (rpcError) {
    return { error: mapAgendaError(rpcError.message) };
  }

  revalidateAgenda();
  return { success: "Situação do horário atualizada." };
}

export async function loadSlotsAction(
  _prev: SlotActionState,
  formData: FormData,
): Promise<SlotActionState> {
  const parsed = parseSlotQueryForm(formData);
  if (!parsed.success) {
    return { error: "Escolha profissional, serviço e data.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const { error, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const loaded = await loadAvailableSlots(
    workspace.id,
    parsed.data.professionalMemberId,
    parsed.data.serviceId,
    parsed.data.localDate,
  );
  const query = {
    localDate: parsed.data.localDate,
    professionalMemberId: parsed.data.professionalMemberId,
    serviceId: parsed.data.serviceId,
  };
  const message = slotQueryMessage(loaded.error, loaded.slots.length);
  if (message) {
    return { error: message, slots: [], ...query };
  }
  return { slots: loaded.slots, ...query };
}

export async function addWorkingHourAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseWorkingPeriodForm(formData);
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const currentMemberId = await loadCurrentMemberId(workspace.id, session.user.id);
  if (!canManageJornada(workspace.role, currentMemberId === parsed.data.memberId)) {
    return { error: "Você não pode alterar os horários desta profissional." };
  }
  const supabase = await createClient();
  const { error: insertError } = await supabase.from("professional_working_hours").insert({
    workspace_id: workspace.id,
    professional_member_id: parsed.data.memberId,
    weekday: parsed.data.weekday,
    start_time: `${parsed.data.startTime}:00`,
    end_time: `${parsed.data.endTime}:00`,
    active: true,
  });
  if (insertError) {
    return { error: mapAgendaError(insertError.message) };
  }
  revalidatePath(`/app/equipe/${parsed.data.memberId}/disponibilidade`);
  revalidatePath("/app/equipe");
  return { success: "Horário adicionado." };
}

export async function addBreakAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseWorkingPeriodForm(formData);
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const currentMemberId = await loadCurrentMemberId(workspace.id, session.user.id);
  if (!canManageJornada(workspace.role, currentMemberId === parsed.data.memberId)) {
    return { error: "Você não pode alterar as pausas deste profissional." };
  }
  const supabase = await createClient();
  const { error: insertError } = await supabase.from("professional_breaks").insert({
    workspace_id: workspace.id,
    professional_member_id: parsed.data.memberId,
    weekday: parsed.data.weekday,
    start_time: `${parsed.data.startTime}:00`,
    end_time: `${parsed.data.endTime}:00`,
    label: parsed.data.label,
    active: true,
  });
  if (insertError) {
    return { error: mapAgendaError(insertError.message) };
  }
  revalidatePath(`/app/equipe/${parsed.data.memberId}/disponibilidade`);
  revalidatePath("/app/equipe");
  return { success: "Pausa adicionada." };
}

export async function deleteWorkingHourAction(formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const currentMemberId = await loadCurrentMemberId(workspace.id, session.user.id);
  if (!canManageJornada(workspace.role, currentMemberId === memberId)) {
    return { error: "Você não pode alterar os horários desta profissional." };
  }
  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from("professional_working_hours")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .eq("professional_member_id", memberId);
  if (deleteError) {
    return { error: mapAgendaError(deleteError.message) };
  }
  revalidatePath(`/app/equipe/${memberId}/disponibilidade`);
  return { success: "Horário removido." };
}

export async function updateWorkingHourAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = readRowId(formData);
  if (!id) {
    return { error: "Não encontramos este horário para alterar." };
  }
  const parsed = parseWorkingPeriodForm(formData);
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const currentMemberId = await loadCurrentMemberId(workspace.id, session.user.id);
  if (!canManageJornada(workspace.role, currentMemberId === parsed.data.memberId)) {
    return { error: "Você não pode alterar os horários desta profissional." };
  }
  const supabase = await createClient();
  const { data, error: updateError } = await supabase
    .from("professional_working_hours")
    .update({
      weekday: parsed.data.weekday,
      start_time: `${parsed.data.startTime}:00`,
      end_time: `${parsed.data.endTime}:00`,
    })
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .eq("professional_member_id", parsed.data.memberId)
    .select("id");
  if (updateError) {
    return { error: mapAgendaError(updateError.message) };
  }
  if (!data?.length) {
    return { error: "Não encontramos este horário para alterar." };
  }
  revalidatePath(`/app/equipe/${parsed.data.memberId}/disponibilidade`);
  revalidatePath("/app/equipe");
  return { success: "Horário atualizado." };
}

export async function deleteBreakAction(formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const currentMemberId = await loadCurrentMemberId(workspace.id, session.user.id);
  if (!canManageJornada(workspace.role, currentMemberId === memberId)) {
    return { error: "Você não pode alterar as pausas deste profissional." };
  }
  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from("professional_breaks")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .eq("professional_member_id", memberId);
  if (deleteError) {
    return { error: mapAgendaError(deleteError.message) };
  }
  revalidatePath(`/app/equipe/${memberId}/disponibilidade`);
  return { success: "Pausa removida." };
}

export async function updateBreakAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = readRowId(formData);
  if (!id) {
    return { error: "Não encontramos esta pausa para alterar." };
  }
  const parsed = parseWorkingPeriodForm(formData);
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const currentMemberId = await loadCurrentMemberId(workspace.id, session.user.id);
  if (!canManageJornada(workspace.role, currentMemberId === parsed.data.memberId)) {
    return { error: "Você não pode alterar as pausas deste profissional." };
  }
  const supabase = await createClient();
  const { data, error: updateError } = await supabase
    .from("professional_breaks")
    .update({
      weekday: parsed.data.weekday,
      start_time: `${parsed.data.startTime}:00`,
      end_time: `${parsed.data.endTime}:00`,
      label: parsed.data.label,
    })
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .eq("professional_member_id", parsed.data.memberId)
    .select("id");
  if (updateError) {
    return { error: mapAgendaError(updateError.message) };
  }
  if (!data?.length) {
    return { error: "Não encontramos esta pausa para alterar." };
  }
  revalidatePath(`/app/equipe/${parsed.data.memberId}/disponibilidade`);
  revalidatePath("/app/equipe");
  return { success: "Pausa atualizada." };
}

export async function addTimeBlockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseTimeBlockForm(formData);
  if (!parsed.success) {
    return validationState(parsed.error);
  }
  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const currentMemberId = await loadCurrentMemberId(workspace.id, session.user.id);
  if (!canManageTimeBlocks(workspace.role, currentMemberId === parsed.data.memberId)) {
    return { error: "Você não pode marcar folga na agenda deste profissional." };
  }
  const { timezone } = await loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug);
  const startsAt = zonedWallTimeToUtc(parsed.data.localDate, parsed.data.startTime, timezone).toISOString();
  const endsAt = zonedWallTimeToUtc(parsed.data.localDate, parsed.data.endTime, timezone).toISOString();
  const supabase = await createClient();
  const { error: insertError } = await supabase.from("professional_time_blocks").insert({
    workspace_id: workspace.id,
    professional_member_id: parsed.data.memberId,
    starts_at: startsAt,
    ends_at: endsAt,
    reason: parsed.data.reason,
  });
  if (insertError) {
    return { error: mapAgendaError(insertError.message) };
  }
  revalidatePath(`/app/equipe/${parsed.data.memberId}/disponibilidade`);
  revalidateAgenda();
  return { success: "Folga marcada." };
}

export async function deleteTimeBlockAction(formData: FormData): Promise<ActionState> {
  const id = String(formData.get("id") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const currentMemberId = await loadCurrentMemberId(workspace.id, session.user.id);
  if (!canManageTimeBlocks(workspace.role, currentMemberId === memberId)) {
    return { error: "Você não pode remover esta folga." };
  }
  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from("professional_time_blocks")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .eq("professional_member_id", memberId);
  if (deleteError) {
    return { error: mapAgendaError(deleteError.message) };
  }
  revalidatePath(`/app/equipe/${memberId}/disponibilidade`);
  revalidateAgenda();
  return { success: "Folga removida." };
}

const checkoutSummarySchema = z.object({
  repeated: z.boolean(),
  amount_due_cents: z.number().int().nonnegative(),
  product_total_cents: z.number().int().nonnegative(),
  received_cents: z.number().int().nonnegative(),
  commission: z.object({
    original_cents: z.number().int().nonnegative(),
    released_cents: z.number().int().nonnegative(),
    status: z.string(),
  }).nullable(),
});

function mapCheckoutError(message: string): string {
  if (message.includes("invalid_amount") || message.includes("receipt_exceeds_due")) {
    return "O desconto ou o valor recebido não cabe neste atendimento.";
  }
  if (message.includes("payment_method_required")) {
    return "Escolha como o valor foi recebido.";
  }
  if (message.includes("invalid_products") || message.includes("insufficient_stock")) {
    return "Não foi possível registrar o produto. Confira a quantidade em estoque.";
  }
  if (message.includes("not_authorized") || message.includes("appointment_write_denied") || message.includes("status_denied")) {
    return "Você não pode concluir este atendimento.";
  }
  if (message.includes("invalid_idempotency_key")) {
    return "Abra o atendimento de novo e confirme outra vez.";
  }
  return mapAgendaError(message);
}

export async function completeAppointmentCheckoutAction(formData: FormData): Promise<ActionState> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (!z.string().uuid().safeParse(appointmentId).success || idempotencyKey.length < 8 || idempotencyKey.length > 80) {
    return { error: "Abra o atendimento de novo e confirme outra vez." };
  }
  const discountRaw = String(formData.get("discount") ?? "").trim();
  const receivedRaw = String(formData.get("received") ?? "").trim();
  const discountCents = discountRaw ? parseReaisToCents(discountRaw) : 0;
  const receivedCents = receivedRaw ? parseReaisToCents(receivedRaw) : 0;
  if (discountCents == null || receivedCents == null) {
    return { error: "Informe os valores em reais, como 10,50." };
  }
  const paymentMethod = String(formData.get("paymentMethod") ?? "");
  const allowedMethods = ["cash", "pix", "debit_card", "credit_card", "bank_transfer", "other"] as const;
  if (receivedCents > 0 && !allowedMethods.includes(paymentMethod as (typeof allowedMethods)[number])) {
    return { error: "Escolha como o valor foi recebido." };
  }
  const productId = String(formData.get("productId") ?? "");
  const products: Array<{ product_id: string; quantity: number; unit_price_cents: number }> = [];
  if (productId) {
    if (!z.string().uuid().safeParse(productId).success) {
      return { error: "Escolha um produto da lista." };
    }
    const quantityRaw = String(formData.get("productQuantity") ?? "").trim().replace(",", ".");
    const quantity = /^\d+(\.\d{1,3})?$/.test(quantityRaw) ? Number(quantityRaw) : NaN;
    const unitPrice = parseReaisToCents(String(formData.get("productPrice") ?? ""));
    if (!Number.isFinite(quantity) || quantity <= 0 || unitPrice == null || unitPrice <= 0) {
      return { error: "Informe a quantidade com até três casas decimais e o preço do produto." };
    }
    products.push({ product_id: productId, quantity, unit_price_cents: unitPrice });
  }

  const { error, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const supabase = await createClient();
  const { data, error: checkoutError } = await supabase.rpc("complete_appointment_checkout", {
    p_appointment_id: appointmentId,
    p_idempotency_key: idempotencyKey,
    p_discount_cents: discountCents,
    p_products: products,
    p_receive_cents: receivedCents,
    p_payment_method: receivedCents > 0 ? paymentMethod as (typeof allowedMethods)[number] : null,
  });
  if (checkoutError) {
    return { error: mapCheckoutError(checkoutError.message) };
  }
  const summary = checkoutSummarySchema.safeParse(data);
  if (!summary.success) {
    revalidateAgenda();
    revalidatePath("/app/financeiro");
    revalidatePath("/app/comissoes");
    return { success: "Atendimento concluído." };
  }
  revalidateAgenda();
  revalidatePath("/app/financeiro");
  revalidatePath("/app/comissoes");
  return {
    success: checkoutMessage(summary.data),
  };
}
