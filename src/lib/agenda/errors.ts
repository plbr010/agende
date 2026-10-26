import { PERIOD_MESSAGES } from "@/lib/agenda/period-rules";

export function mapAgendaError(message: string): string {
  if (message.includes("booking_creation_paused")) {
    return "A agenda deste salão não está aberta para novos agendamentos.";
  }
  if (message.includes("workspace_subscription_inactive") || message.includes("workspace_unavailable")) {
    return "O teste grátis ou a assinatura deste salão não está ativo.";
  }
  if (message.includes("outside_working_hours")) {
    return "Esse horário está fora do horário de atendimento da profissional.";
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
    return "Cliente não encontrado neste salão.";
  }
  if (message.includes("appointment_terminal") || message.includes("appointment_in_progress")) {
    return "Este agendamento não pode mais ser reagendado.";
  }
  if (message.includes("status_denied") || message.includes("invalid_status_transition")) {
    return "Essa mudança de situação não é permitida.";
  }
  if (
    message.includes("appointment_write_denied") ||
    message.includes("not_authorized") ||
    message.includes("42501") ||
    message.includes("permission denied")
  ) {
    return "Você não tem permissão para esta ação.";
  }
  if (message.includes("appointment_crosses_local_date")) {
    return "O atendimento precisa caber no mesmo dia.";
  }
  if (message.includes("working_hours_no_overlap") || message.includes("professional_breaks_no_overlap")) {
    return PERIOD_MESSAGES.overlap;
  }
  if (message.includes("professional_time_blocks_no_overlap")) {
    return "Esta folga cruza outra que já está marcada. Escolha outro horário.";
  }
  if (
    message.includes("working_hours_identity_immutable") ||
    message.includes("break_identity_immutable") ||
    message.includes("time_block_identity_immutable")
  ) {
    return "Não foi possível alterar este horário. Tente de novo.";
  }
  return "Não deu certo salvar. Tente de novo.";
}

export function slotQueryMessage(errorMessage: string | null | undefined, slotCount: number): string | null {
  if (errorMessage) return mapAgendaError(errorMessage);
  if (slotCount === 0) return "Nenhum horário livre neste dia.";
  return null;
}
