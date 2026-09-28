"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { loadMyAppointments, type MyAppointment } from "@/lib/booking/queries";
import { hashClientIp } from "@/lib/booking/ip";
import {
  parsePublicBookingConfirmation,
  parsePublicBookingCatalog,
  type PublicBookingCatalog,
  type PublicBookingConfirmation,
} from "@/lib/booking/queries";
import { parsePublicBookingDetails, sanitizeBookingError } from "@/lib/booking/validation";

export type BookingActionState = {
  error?: string;
  confirmation?: PublicBookingConfirmation;
};

export async function fetchPublicSlotsAction(input: {
  slug: string;
  serviceId: string;
  professionalMemberId: string | null;
  localDate: string;
}): Promise<{ slots: string[]; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_public_available_slots", {
    p_slug: input.slug,
    p_service_id: input.serviceId,
    p_professional_member_id: input.professionalMemberId,
    p_local_date: input.localDate,
  });
  if (error) {
    return { slots: [], error: sanitizeBookingError(error.message) };
  }
  return {
    slots: (data ?? [])
      .map((row) => (typeof row.starts_at === "string" ? row.starts_at : null))
      .filter((value): value is string => Boolean(value)),
  };
}

export async function createPublicAppointmentAction(
  input: {
    slug: string;
    serviceId: string;
    professionalMemberId: string | null;
    startsAt: string;
    fullName: string;
    phone: string;
    email: string;
    customerNote: string | null;
  },
): Promise<BookingActionState> {
  const parsed = parsePublicBookingDetails({
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    customerNote: input.customerNote,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revise seus dados." };
  }

  const supabase = await createClient();
  const ipHash = await hashClientIp();
  const { data, error } = await supabase.rpc("create_public_appointment", {
    p_slug: input.slug,
    p_service_id: input.serviceId,
    p_professional_member_id: input.professionalMemberId,
    p_starts_at: input.startsAt,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    p_email: parsed.data.email,
    p_customer_note: parsed.data.customerNote,
    p_ip_hash: ipHash,
  });

  if (error) {
    return { error: sanitizeBookingError(error.message) };
  }
  const confirmation = parsePublicBookingConfirmation(data);
  if (!confirmation) {
    return { error: "Reserva criada, mas não foi possível montar o comprovante." };
  }
  return { confirmation };
}

export async function cancelMyAppointmentAction(appointmentId: string): Promise<{ error?: string; success?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_appointment", { p_appointment_id: appointmentId });
  if (error) {
    return { error: sanitizeBookingError(error.message) };
  }
  return { success: "Agendamento cancelado." };
}

export async function loadCatalogAction(slug: string): Promise<PublicBookingCatalog | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_public_booking_catalog", { p_slug: slug });
  return parsePublicBookingCatalog(data);
}

export async function rescheduleMyAppointmentAction(input: {
  appointmentId: string; startsAt: string; professionalMemberId: string;
}): Promise<{ error?: string; appointments?: MyAppointment[] }> {
  const parsed = z.object({ appointmentId: z.string().uuid(), startsAt: z.string().datetime({ offset: true }), professionalMemberId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { error: "Escolha um profissional e um horário válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reschedule_my_appointment", {
    p_appointment_id: parsed.data.appointmentId,
    p_starts_at: parsed.data.startsAt,
    p_professional_member_id: parsed.data.professionalMemberId,
  });
  if (error) return { error: sanitizeBookingError(error.message) };
  revalidatePath("/cliente");
  revalidatePath("/cliente/agendamentos");
  revalidatePath("/app/agenda");
  return { appointments: await loadMyAppointments() };
}

export async function fetchMyRescheduleSlots(input: { appointmentId: string; professionalMemberId: string; localDate: string }): Promise<{ slots: string[]; error?: string }> {
  const parsed = z.object({ appointmentId: z.string().uuid(), professionalMemberId: z.string().uuid(), localDate: z.string().date() }).safeParse(input);
  if (!parsed.success) return { slots: [], error: "Escolha uma data e um profissional válidos." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_reschedule_slots", { p_appointment_id: parsed.data.appointmentId, p_professional_member_id: parsed.data.professionalMemberId, p_local_date: parsed.data.localDate });
  if (error) return { slots: [], error: sanitizeBookingError(error.message) };
  return { slots: (data ?? []).map(row => row.starts_at) };
}
