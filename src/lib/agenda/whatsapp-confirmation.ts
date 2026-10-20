import { buildWhatsAppLink } from "@/lib/booking/calendar";
import { normalizePhone } from "@/lib/validation/phone";
import type { AppointmentStatus } from "@/lib/agenda/status";

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function formatAppointmentDateLabel(localDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return localDate;
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return localDate;
  return `${Number(match[3])} de ${month} de ${match[1]}`;
}

export function clientFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/).filter(Boolean)[0] ?? "";
}

export function professionalConfirmationMessage(input: {
  clientName: string;
  workspaceName: string;
  serviceName: string;
  professionalName: string;
  localDate: string;
  localTime: string;
}): string {
  const first = clientFirstName(input.clientName);
  const hello = first ? `Olá, ${first}! 💗` : "Olá! 💗";
  return [
    hello,
    "",
    `Seu agendamento no *${input.workspaceName}* está confirmado!`,
    "",
    `✨ Serviço: ${input.serviceName}`,
    `👤 Profissional: ${input.professionalName}`,
    `📅 Data: ${formatAppointmentDateLabel(input.localDate)}`,
    `🕒 Horário: ${input.localTime}`,
    "",
    "Estamos te esperando! 💕",
  ].join("\n");
}

export function professionalPendingMessage(input: {
  clientName: string;
  workspaceName: string;
  serviceName: string;
  professionalName: string;
  localDate: string;
  localTime: string;
}): string {
  const first = clientFirstName(input.clientName);
  const hello = first ? `Olá, ${first}! 💗` : "Olá! 💗";
  return [
    hello,
    "",
    `Recebemos sua solicitação de agendamento no *${input.workspaceName}*. Ela ainda aguarda confirmação.`,
    "",
    `✨ Serviço: ${input.serviceName}`,
    `👤 Profissional: ${input.professionalName}`,
    `📅 Data: ${formatAppointmentDateLabel(input.localDate)}`,
    `🕒 Horário: ${input.localTime}`,
    "",
    "Avisaremos assim que for confirmada. 💕",
  ].join("\n");
}

export type WhatsAppConfirmationPlan =
  | { mode: "send"; href: string; message: string }
  | { mode: "copy-only"; message: string; guidance: string }
  | { mode: "blocked"; guidance: string };

const BLOCKED: Partial<Record<AppointmentStatus, string>> = {
  cancelled: "Este horário foi cancelado. Não envie uma confirmação.",
  no_show: "Este horário foi marcado como falta. A confirmação não se aplica.",
  completed: "Este atendimento já foi concluído.",
  in_progress: "Este atendimento já começou. A mensagem de confirmação não se aplica.",
};

export function buildWhatsAppConfirmation(input: {
  status: AppointmentStatus;
  phone: string | null;
  clientName: string;
  workspaceName: string;
  serviceName: string;
  professionalName: string;
  localDate: string;
  localTime: string;
}): WhatsAppConfirmationPlan {
  const blocked = BLOCKED[input.status];
  if (blocked) {
    return { mode: "blocked", guidance: blocked };
  }
  const message =
    input.status === "confirmed" ? professionalConfirmationMessage(input) : professionalPendingMessage(input);
  const href = buildWhatsAppLink(normalizePhone(input.phone ?? ""), message);
  if (!href) {
    return {
      mode: "copy-only",
      message,
      guidance: "Não há um celular válido neste cadastro. Copie a mensagem e envie por outro meio.",
    };
  }
  return { mode: "send", href, message };
}
