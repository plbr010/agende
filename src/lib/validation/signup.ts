import { z } from "zod";
import { isValidEmail, normalizeEmail } from "@/lib/validation/email";
import { isValidPhone, normalizePhone } from "@/lib/validation/phone";

export const signupIntentSchema = z.enum(["client", "professional"]);

export const signupSchema = z
  .object({
    intendedUse: signupIntentSchema,
    fullName: z
      .string()
      .trim()
      .min(2, "Informe seu nome completo.")
      .max(120, "Nome muito longo."),
    email: z
      .string()
      .trim()
      .min(1, "Informe um e-mail.")
      .refine(isValidEmail, "Informe um e-mail válido."),
    phone: z
      .string()
      .trim()
      .min(1, "Informe um celular.")
      .refine(isValidPhone, "Informe um celular brasileiro válido."),
    password: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres.")
      .regex(/[A-Za-z]/, "A senha deve conter letras.")
      .regex(/[0-9]/, "A senha deve conter números."),
    confirmPassword: z.string(),
    termsAccepted: z.boolean().refine((value) => value === true, {
      message: "Aceite os Termos de Uso e a Política de Privacidade.",
    }),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;

export function parseSignupForm(formData: FormData) {
  const raw = {
    intendedUse: formData.get("intendedUse"),
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    termsAccepted: formData.get("termsAccepted") === "on" || formData.get("termsAccepted") === "true",
  };

  const parsed = signupSchema.safeParse({
    ...raw,
    termsAccepted: raw.termsAccepted === true ? true : undefined,
  });

  if (!parsed.success) {
    return parsed;
  }

  return {
    success: true as const,
    data: {
      ...parsed.data,
      email: normalizeEmail(parsed.data.email),
      phone: normalizePhone(parsed.data.phone)!,
      fullName: parsed.data.fullName.trim(),
    },
  };
}

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Informe um e-mail.")
    .refine(isValidEmail, "Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});

export const workspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe o nome do negócio.")
    .max(80, "Nome muito longo."),
});
