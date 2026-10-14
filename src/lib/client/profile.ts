import { z } from "zod";
import { isValidPhone, normalizePhone } from "@/lib/validation/phone";

export const clientProfileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Informe seu nome completo.")
    .max(120, "O nome pode ter no máximo 120 caracteres."),
  phone: z
    .string()
    .trim()
    .min(1, "Informe um celular com DDD.")
    .refine(isValidPhone, "Informe um telefone brasileiro válido, com DDD.")
    .transform((value) => normalizePhone(value) ?? value),
});

export type ClientProfileUpdate = z.infer<typeof clientProfileUpdateSchema>;

export function parseClientProfileUpdate(form: { fullName?: string | null; phone?: string | null }) {
  return clientProfileUpdateSchema.safeParse({
    fullName: form.fullName ?? "",
    phone: form.phone ?? "",
  });
}

export function firstNameFrom(fullName: string): string {
  return fullName.split(/\s+/).filter(Boolean)[0] ?? "";
}
