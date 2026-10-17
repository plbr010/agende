"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { appointmentWhatsAppMessage, appointmentWhatsAppDetails, whatsappAppointmentSchema, type AppointmentWhatsAppDetails } from "./whatsapp";
import { buildWhatsAppLink } from "@/lib/booking/calendar";

export type AppointmentWhatsAppResult = {
  appointment?: AppointmentWhatsAppDetails & { id: string };
  message?: string;
  url?: string;
  error?: string;
};
export async function prepareAppointmentWhatsApp(appointmentId: string): Promise<AppointmentWhatsAppResult> {
  if (!z.string().uuid().safeParse(appointmentId).success) return { error: "Agendamento inválido." };
  try {
    const client = await createClient();
    const { data, error } = await client.rpc("get_appointment_whatsapp", { p_appointment_id: appointmentId });
    const parsed = whatsappAppointmentSchema.safeParse(data);
    if (error || !parsed.success) return { error: "Este agendamento não está disponível para confirmação pelo WhatsApp. Atualize a agenda." };
    const message = appointmentWhatsAppMessage(parsed.data);
    const url = buildWhatsAppLink(parsed.data.phone, message);
    return { appointment: { id: appointmentId, ...appointmentWhatsAppDetails(parsed.data) }, message, ...(url ? { url } : { error: "Cadastre um telefone internacional válido do cliente, com + e código do país, antes de abrir o WhatsApp." }) };
  } catch { return { error: "Não foi possível preparar a mensagem. Verifique o horário e o fuso do estabelecimento." }; }
}
