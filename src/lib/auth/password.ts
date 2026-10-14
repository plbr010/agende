import { z } from "zod";

export const newPasswordSchema = z.object({
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.")
    .max(128, "A senha deve ter no máximo 128 caracteres.")
    .regex(/[A-Za-z]/, "A senha deve conter letras.")
    .regex(/[0-9]/, "A senha deve conter números."),
  confirmPassword: z.string(),
}).refine(v => v.password === v.confirmPassword, {
  message: "As senhas não coincidem.", path: ["confirmPassword"],
});

export const RECOVERY_ERROR = "Este link é inválido ou expirou. Solicite um novo e-mail de recuperação.";
export const RECOVERY_BROWSER_MISMATCH = "Abra o link no mesmo navegador e dispositivo onde pediu a recuperação. Se não puder voltar a ele, solicite um novo e-mail neste navegador e abra o novo link aqui.";
