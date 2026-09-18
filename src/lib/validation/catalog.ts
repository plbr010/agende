import { z } from "zod";
import { isValidEmail, normalizeEmail } from "@/lib/validation/email";
import { isValidPhone, normalizePhone } from "@/lib/validation/phone";
import {
  CLIENT_NOTES_MAX,
  SERVICE_DURATION_MAX,
  SERVICE_DURATION_MIN,
  SERVICE_NAME_MAX,
  isValidDurationMinutes,
  parseReaisToCents,
} from "@/lib/validation/money";

export const professionalProfileSchema = z.object({
  memberId: z.string().uuid("Profissional inválido."),
  displayName: z
    .string()
    .trim()
    .min(2, "Informe um nome de 2 a 80 caracteres.")
    .max(80, "Informe um nome de 2 a 80 caracteres."),
  bio: z
    .string()
    .trim()
    .max(500, "A bio pode ter no máximo 500 caracteres.")
    .optional()
    .transform((value) => (value ? value : null)),
  bookingEnabled: z.boolean().optional(),
});

export const serviceSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome do serviço.")
    .max(SERVICE_NAME_MAX, "Nome muito longo."),
  description: z
    .string()
    .trim()
    .max(500, "A descrição pode ter no máximo 500 caracteres.")
    .optional()
    .transform((value) => (value ? value : null)),
  durationMinutes: z.coerce
    .number()
    .int("Duração inválida.")
    .refine(isValidDurationMinutes, `A duração deve ser entre ${SERVICE_DURATION_MIN} e ${SERVICE_DURATION_MAX} minutos.`),
  priceReais: z
    .string()
    .trim()
    .min(1, "Informe o preço.")
    .refine((value) => parseReaisToCents(value) !== null, "Informe um preço válido em reais."),
  active: z.boolean().default(true),
  professionalMemberIds: z.array(z.string().uuid()).default([]),
});

export const clientSchema = z.object({
  id: z.string().uuid().optional(),
  fullName: z
    .string()
    .trim()
    .min(2, "Informe o nome completo.")
    .max(120, "Nome muito longo."),
  email: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? normalizeEmail(value) : null))
    .refine((value) => value === null || isValidEmail(value), "Informe um e-mail válido."),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? "")
    .refine((value) => value === "" || isValidPhone(value), "Informe um celular brasileiro válido.")
    .transform((value) => (value ? normalizePhone(value) : null)),
  birthDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), "Data de nascimento inválida."),
  notes: z
    .string()
    .trim()
    .max(CLIENT_NOTES_MAX, "Observações muito longas.")
    .optional()
    .transform((value) => (value ? value : null)),
});

export function parseServiceForm(formData: FormData) {
  const professionalMemberIds = formData
    .getAll("professionalMemberIds")
    .map((value) => String(value))
    .filter(Boolean);

  return serviceSchema.safeParse({
    id: String(formData.get("id") ?? "") || undefined,
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    durationMinutes: formData.get("durationMinutes"),
    priceReais: formData.get("priceReais"),
    active: formData.get("active") === "on" || formData.get("active") === "true",
    professionalMemberIds,
  });
}

export function parseClientForm(formData: FormData) {
  return clientSchema.safeParse({
    id: String(formData.get("id") ?? "") || undefined,
    fullName: formData.get("fullName"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    birthDate: formData.get("birthDate") ?? "",
    notes: formData.get("notes") ?? "",
  });
}

export function parseProfileForm(formData: FormData) {
  return professionalProfileSchema.safeParse({
    memberId: formData.get("memberId"),
    displayName: formData.get("displayName"),
    bio: formData.get("bio") ?? "",
    bookingEnabled: formData.has("manageBooking")
      ? formData.get("bookingEnabled") === "on" || formData.get("bookingEnabled") === "true"
      : undefined,
  });
}

export { SERVICE_DURATION_MIN, SERVICE_DURATION_MAX };
