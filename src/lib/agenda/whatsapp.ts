export { internationalPhoneDigits } from "@/lib/validation/international-phone";
import { z } from "zod";

export const whatsappAppointmentSchema = z.object({
  clientName: z.string().min(1), phone: z.string().nullable(), workspaceName: z.string().min(1),
  serviceName: z.string().min(1), professionalName: z.string().min(1), startsAt: z.string().datetime({ offset: true }),
  timezone: z.string(), status: z.enum(["scheduled", "confirmed"]),
});
export type WhatsAppAppointment = z.infer<typeof whatsappAppointmentSchema>;

export function appointmentWhatsAppMessage(input: WhatsAppAppointment): string {
  const value = whatsappAppointmentSchema.parse(input);
  // Strip control characters and WhatsApp formatting from user-editable names.
  const name = (text: string) => text.replace(/[\u0000-\u001f\u007f*_~`]/g, " ").replace(/\s+/g, " ").trim();
  const first = name(value.clientName).split(" ")[0] || "tudo bem";
  const when = new Date(value.startsAt);
  const date = new Intl.DateTimeFormat("pt-BR", { timeZone: value.timezone, dateStyle: "long" }).format(when);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: value.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(when);
  const intro = value.status === "confirmed"
    ? `Seu agendamento no *${name(value.workspaceName)}* está confirmado!`
    : `Recebemos sua solicitação de agendamento no *${name(value.workspaceName)}*. Ela ainda aguarda confirmação.`;
  return `Olá, ${first}! 💗\n\n${intro}\n\n✨ Serviço: ${name(value.serviceName)}\n👤 Profissional: ${name(value.professionalName)}\n📅 Data: ${date}\n🕒 Horário: ${time}\n\n${value.status === "confirmed" ? "Estamos te esperando! 💕" : "Avisaremos assim que for confirmada. 💕"}`;
}
