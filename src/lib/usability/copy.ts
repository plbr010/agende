import type { AppointmentStatus } from "@/lib/agenda/status";
import type { BookingStep } from "@/lib/booking/config";

/** Verbos claros para botões de situação na agenda. Os selos continuam em STATUS_LABEL. */
export const STATUS_ACTION_LABEL: Record<AppointmentStatus, string> = {
  scheduled: "Marcar como agendado",
  confirmed: "Confirmar cliente",
  in_progress: "Começar atendimento",
  completed: "Finalizar atendimento",
  cancelled: "Cancelar horário",
  no_show: "Cliente não veio",
};

export const BOOKING_STEP_PROMPT: Record<BookingStep, string> = {
  service: "Escolha o serviço",
  professional: "Escolha quem atende",
  date: "Escolha o dia",
  slot: "Escolha o horário",
  details: "Confira seus dados",
  confirm: "Confirme a reserva",
};

export const PASSWORD_HINT = "Use no mínimo 8 caracteres, com letras e números.";

export const TRIAL_PLAIN =
  "Por 7 dias você usa tudo do plano escolhido. Não pedimos cartão. Trocar de plano no teste não zera os 7 dias.";

export function bookingStepCaption(step: BookingStep, index: number, total: number): string {
  return `Passo ${index + 1} de ${total}: ${BOOKING_STEP_PROMPT[step]}`;
}

export function shouldSkipProfessionalStep(professionalCount: number): boolean {
  return professionalCount === 1;
}

export const FORBIDDEN_USER_FACING_PATTERNS = [
  /\bbanco guarda\b/i,
  /\bcalculados no servidor\b/i,
  /\btoken bruto\b/i,
  /\bDar baixa\b/,
  /\bTicket médio\b/,
  /\bno fuso do estabelecimento\b/i,
  /\bAssinatura do workspace\b/i,
  /\bmembros no workspace\b/i,
] as const;
