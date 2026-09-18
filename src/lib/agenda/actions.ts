"use server";

import { revalidatePath } from "next/cache";
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
import { zonedWallTimeToUtc } from "@/lib/time/timezone";

export type SlotActionState = ActionState & {
  slots?: string[];
  localDate?: string;
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

function mapAgendaError(message: string): string {
  if (message.includes("outside_working_hours")) {
    return "Esse horário está fora da jornada do profissional.";
  }
  if (message.includes("inside_break")) {
    return "Esse horário cai em uma pausa.";
  }
  if (message.includes("inside_time_block")) {
    return "Esse horário está bloqueado na agenda.";
  }
  if (message.includes("appointment_overlap") || message.includes("23P01")) {
    return "Já existe um agendamento neste horário.";
  }
  if (message.includes("service_inactive")) {
    return "Este serviço não está disponível para agendar.";
  }
  if (message.includes("professional_booking_disabled") || message.includes("professional_inactive")) {
    return "Este profissional não está atendendo no momento.";
  }
  if (message.includes("professional_service_inactive")) {
    return "Este profissional não realiza o serviço escolhido.";
  }
  if (message.includes("client_not_found") || message.includes("client_archived")) {
    return "Cliente não encontrado neste negócio.";
  }
  if (message.includes("appointment_terminal") || message.includes("appointment_in_progress")) {
    return "Este agendamento não pode mais ser reagendado.";
  }
  if (message.includes("status_denied") || message.includes("invalid_status_transition")) {
    return "Essa mudança de status não é permitida.";
  }
  if (message.includes("appointment_write_denied") || message.includes("42501") || message.includes("permission denied")) {
    return "Você não tem permissão para esta ação.";
  }
  if (message.includes("appointment_crosses_local_date")) {
    return "O atendimento precisa caber no mesmo dia.";
  }
  if (message.includes("working_hours_no_overlap") || message.includes("professional_breaks_no_overlap")) {
    return "Esse período se sobrepõe a outro já cadastrado.";
  }
  return "Não foi possível salvar. Tente novamente.";
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
    return { error: "Status inválido." };
  }

  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  if (!isAppointmentStatus(parsed.data.status)) {
    return { error: "Status inválido." };
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
  return { success: "Status atualizado." };
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
  const slots = await loadAvailableSlots(
    workspace.id,
    parsed.data.professionalMemberId,
    parsed.data.serviceId,
    parsed.data.localDate,
  );
  if (slots.length === 0) {
    return {
      error: "Nenhum horário livre neste dia.",
      slots: [],
      localDate: parsed.data.localDate,
    };
  }
  return { slots, localDate: parsed.data.localDate, success: "Horários atualizados." };
}

export async function addWorkingHourAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseWorkingPeriodForm(formData);
  if (!parsed.success) {
    return { error: "Revise os horários.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const currentMemberId = await loadCurrentMemberId(workspace.id, session.user.id);
  if (!canManageJornada(workspace.role, currentMemberId === parsed.data.memberId)) {
    return { error: "Você não pode alterar a jornada deste profissional." };
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
  return { success: "Período adicionado." };
}

export async function addBreakAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseWorkingPeriodForm(formData);
  if (!parsed.success) {
    return { error: "Revise os horários.", fieldErrors: fieldErrorsFromZod(parsed.error) };
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
    return { error: "Você não pode alterar a jornada deste profissional." };
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
  return { success: "Período removido." };
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

export async function addTimeBlockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseTimeBlockForm(formData);
  if (!parsed.success) {
    return { error: "Revise o bloqueio.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const { error, session, workspace } = await requireWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const currentMemberId = await loadCurrentMemberId(workspace.id, session.user.id);
  if (!canManageTimeBlocks(workspace.role, currentMemberId === parsed.data.memberId)) {
    return { error: "Você não pode bloquear a agenda deste profissional." };
  }
  const startsAt = zonedWallTimeToUtc(parsed.data.localDate, parsed.data.startTime).toISOString();
  const endsAt = zonedWallTimeToUtc(parsed.data.localDate, parsed.data.endTime).toISOString();
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
  return { success: "Horário bloqueado." };
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
    return { error: "Você não pode remover este bloqueio." };
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
  return { success: "Bloqueio removido." };
}
