import { z } from "zod";
import { compareTime, parseTimeInput } from "@/lib/time/timezone";
import { isAppointmentStatus } from "@/lib/agenda/status";

export const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
] as const;

export const appointmentCreateSchema = z.object({
  clientId: z.string().uuid("Cliente inválido."),
  professionalMemberId: z.string().uuid("Profissional inválido."),
  serviceId: z.string().uuid("Serviço inválido."),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
  startsAt: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
      "Horário inválido.",
    ),
  notes: z
    .string()
    .trim()
    .max(2000, "Observações muito longas.")
    .optional()
    .transform((value) => (value ? value : null)),
});

export const appointmentRescheduleSchema = z.object({
  appointmentId: z.string().uuid("Agendamento inválido."),
  professionalMemberId: z.string().uuid("Profissional inválido."),
  serviceId: z.string().uuid("Serviço inválido."),
  startsAt: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
      "Horário inválido.",
    ),
  notes: z
    .string()
    .trim()
    .max(2000, "Observações muito longas.")
    .optional()
    .transform((value) => (value ? value : null)),
});

export const appointmentStatusSchema = z.object({
  appointmentId: z.string().uuid("Agendamento inválido."),
  status: z.string().refine(isAppointmentStatus, "Status inválido."),
});

export const workingPeriodSchema = z
  .object({
    memberId: z.string().uuid("Profissional inválido."),
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: z
      .string()
      .refine((value) => parseTimeInput(value) !== null, "Hora inicial inválida.")
      .transform((value) => parseTimeInput(value)!),
    endTime: z
      .string()
      .refine((value) => parseTimeInput(value) !== null, "Hora final inválida.")
      .transform((value) => parseTimeInput(value)!),
    label: z
      .string()
      .trim()
      .max(80, "Rótulo muito longo.")
      .optional()
      .transform((value) => (value ? value : null)),
  })
  .refine((value) => compareTime(value.startTime, value.endTime) < 0, {
    message: "O horário inicial deve ser anterior ao final.",
    path: ["endTime"],
  });

export const timeBlockSchema = z
  .object({
    memberId: z.string().uuid("Profissional inválido."),
    localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
    startTime: z
      .string()
      .refine((value) => parseTimeInput(value) !== null, "Hora inicial inválida.")
      .transform((value) => parseTimeInput(value)!),
    endTime: z
      .string()
      .refine((value) => parseTimeInput(value) !== null, "Hora final inválida.")
      .transform((value) => parseTimeInput(value)!),
    reason: z
      .string()
      .trim()
      .max(200, "Motivo muito longo.")
      .optional()
      .transform((value) => (value ? value : null)),
  })
  .refine((value) => compareTime(value.startTime, value.endTime) < 0, {
    message: "O horário inicial deve ser anterior ao final.",
    path: ["endTime"],
  });

export const slotQuerySchema = z.object({
  professionalMemberId: z.string().uuid("Profissional inválido."),
  serviceId: z.string().uuid("Serviço inválido."),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
});

export function parseAppointmentCreateForm(formData: FormData) {
  return appointmentCreateSchema.safeParse({
    clientId: formData.get("clientId"),
    professionalMemberId: formData.get("professionalMemberId"),
    serviceId: formData.get("serviceId"),
    localDate: formData.get("localDate"),
    startsAt: formData.get("startsAt"),
    notes: formData.get("notes") ?? "",
  });
}

export function parseAppointmentRescheduleForm(formData: FormData) {
  return appointmentRescheduleSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    professionalMemberId: formData.get("professionalMemberId"),
    serviceId: formData.get("serviceId"),
    startsAt: formData.get("startsAt"),
    notes: formData.get("notes") ?? "",
  });
}

export function parseAppointmentStatusForm(formData: FormData) {
  return appointmentStatusSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    status: formData.get("status"),
  });
}

export function parseWorkingPeriodForm(formData: FormData) {
  return workingPeriodSchema.safeParse({
    memberId: formData.get("memberId"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    label: formData.get("label") ?? "",
  });
}

export function parseTimeBlockForm(formData: FormData) {
  return timeBlockSchema.safeParse({
    memberId: formData.get("memberId"),
    localDate: formData.get("localDate"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    reason: formData.get("reason") ?? "",
  });
}

export function parseSlotQueryForm(formData: FormData) {
  return slotQuerySchema.safeParse({
    professionalMemberId: formData.get("professionalMemberId"),
    serviceId: formData.get("serviceId"),
    localDate: formData.get("localDate"),
  });
}
