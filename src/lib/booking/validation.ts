import { z } from "zod";
import { CUSTOMER_NOTE_MAX } from "@/lib/booking/config";
import { isValidEmail, normalizeEmail } from "@/lib/validation/email";
import { isValidPhone, normalizePhone } from "@/lib/validation/phone";

const omittedToUndefined = (value: unknown) => (value == null || value === "" ? undefined : value);

export const publicBookingDetailsSchema = z.object({
  fullName: z.preprocess(
    omittedToUndefined,
    z
      .string()
      .trim()
      .min(2, "Informe seu nome completo.")
      .max(120, "O nome pode ter no máximo 120 caracteres."),
  ),
  phone: z.preprocess(
    omittedToUndefined,
    z
      .string()
      .trim()
      .min(1, "Informe um celular com DDD.")
      .superRefine((value, ctx) => {
        if (!isValidPhone(value)) {
          ctx.addIssue({ code: "custom", message: "Informe um telefone brasileiro válido, com DDD." });
        }
      })
      .transform((value) => normalizePhone(value) ?? value),
  ),
  email: z.preprocess(
    omittedToUndefined,
    z
      .string()
      .trim()
      .min(1, "Informe um e-mail.")
      .transform((value) => normalizeEmail(value))
      .superRefine((value, ctx) => {
        if (!isValidEmail(value)) {
          ctx.addIssue({ code: "custom", message: "Informe um e-mail válido." });
        }
      }),
  ),
  customerNote: z.preprocess(
    omittedToUndefined,
    z
      .string()
      .trim()
      .max(CUSTOMER_NOTE_MAX, `A observação pode ter no máximo ${CUSTOMER_NOTE_MAX} caracteres.`)
      .optional()
      .transform((value) => (value ? value : null)),
  ),
});

export type PublicBookingDetails = z.infer<typeof publicBookingDetailsSchema>;

export function parsePublicBookingDetails(form: {
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  customerNote?: string | null;
}) {
  return publicBookingDetailsSchema.safeParse({
    fullName: form.fullName ?? null,
    phone: form.phone ?? null,
    email: form.email ?? null,
    customerNote: form.customerNote ?? null,
  });
}

export function canClientCancel(
  status: string,
  startsAtIso: string,
  leadMinutes: number,
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: "terminal" | "in_progress" | "too_late" } {
  if (status === "completed" || status === "cancelled" || status === "no_show") {
    return { ok: false, reason: "terminal" };
  }
  if (status === "in_progress") {
    return { ok: false, reason: "in_progress" };
  }
  if (new Date(startsAtIso).getTime() < now.getTime() + leadMinutes * 60_000) {
    return { ok: false, reason: "too_late" };
  }
  return { ok: true };
}

export function nextBookingStep(
  current: "service" | "professional" | "date" | "slot" | "details" | "confirm",
): typeof current | "success" {
  const order = ["service", "professional", "date", "slot", "details", "confirm"] as const;
  const index = order.indexOf(current);
  if (index < 0 || index >= order.length - 1) {
    return "success";
  }
  return order[index + 1];
}

export function previousBookingStep(
  current: "service" | "professional" | "date" | "slot" | "details" | "confirm",
): typeof current {
  const order = ["service", "professional", "date", "slot", "details", "confirm"] as const;
  const index = order.indexOf(current);
  return order[Math.max(0, index - 1)];
}

export function partitionClientAppointments<T extends { startsAt: string; status: string }>(
  items: T[],
  now: Date = new Date(),
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const item of items) {
    if (
      new Date(item.startsAt).getTime() >= now.getTime() &&
      item.status !== "cancelled" &&
      item.status !== "completed" &&
      item.status !== "no_show"
    ) {
      upcoming.push(item);
    } else {
      past.push(item);
    }
  }
  upcoming.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  past.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return { upcoming, past };
}

export function sanitizeBookingError(message: string | null | undefined): string {
  const value = (message ?? "").toLowerCase();
  if (value.includes("slot_taken") || value.includes("appointment_overlap") || value.includes("23p01")) {
    return "Esse horário acabou de ser reservado. Escolha outro horário.";
  }
  if (value.includes("slot_too_soon") || value.includes("slot_in_past")) {
    return "Esse horário já passou. Escolha outro.";
  }
  if (value.includes("slot_too_far")) {
    return "Escolha uma data dentro dos próximos 90 dias.";
  }
  if (value.includes("booking_rate_limited")) {
    return "Muitas tentativas seguidas. Espere um pouco e tente de novo.";
  }
  if (value.includes("service_inactive") || value.includes("service_not_found")) {
    return "Este serviço não está disponível no momento.";
  }
  if (value.includes("professional_booking_disabled") || value.includes("professional_not_found")) {
    return "Esta profissional não está disponível para agendamento.";
  }
  if (value.includes("outside_working_hours") || value.includes("inside_break") || value.includes("inside_time_block")) {
    return "Esse horário não está disponível. Escolha outro.";
  }
  if (value.includes("invalid_phone")) {
    return "Informe um telefone brasileiro válido, com DDD.";
  }
  if (value.includes("invalid_email")) {
    return "Informe um e-mail válido.";
  }
  if (value.includes("cancel_too_late")) {
    return "Faltam menos de 2 horas. Não é mais possível cancelar por aqui.";
  }
  if (value.includes("appointment_not_cancellable") || value.includes("appointment_terminal")) {
    return "Este agendamento não pode ser cancelado.";
  }
  if (value.includes("appointment_not_found")) {
    return "Não encontramos esse agendamento.";
  }
  return "Não foi possível concluir. Tente de novo.";
}
