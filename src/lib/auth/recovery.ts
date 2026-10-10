import type { SupabaseClient } from "@supabase/supabase-js";
import { newPasswordSchema, RECOVERY_ERROR } from "@/lib/auth/password";
import { loginSchema } from "@/lib/validation/signup";
import { normalizeEmail } from "@/lib/validation/email";

type Auth = SupabaseClient["auth"];

export async function sendRecovery(auth: Pick<Auth, "resetPasswordForEmail">, email: unknown, origin: string) {
  const parsed = loginSchema.shape.email.safeParse(email);
  if (!parsed.success) return { error: "Informe um e-mail válido." };
  const { error } = await auth.resetPasswordForEmail(normalizeEmail(parsed.data), { redirectTo: new URL("/auth/recovery", origin).href });
  if (error) return { error: "Não foi possível enviar agora. Aguarde um minuto e tente novamente." };
  return { success: "Se existir conta com esse e-mail, mandamos um link. Abra o link e volte aqui para criar a senha." };
}

export async function exchangeRecovery(auth: Pick<Auth, "exchangeCodeForSession" | "verifyOtp">, params: URLSearchParams): Promise<boolean> {
  if (params.has("error") || params.has("error_code")) return false;
  const code = params.get("code"), token = params.get("token_hash");
  const result = code ? await auth.exchangeCodeForSession(code)
    : token && params.get("type") === "recovery" ? await auth.verifyOtp({ token_hash: token, type: "recovery" }) : null;
  return Boolean(result && !result.error && result.data.user);
}

export async function changeRecoveredPassword(auth: Pick<Auth, "getUser" | "updateUser" | "signOut">, input: unknown) {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { data: { user }, error: authError } = await auth.getUser();
  if (authError || !user) return { error: RECOVERY_ERROR };
  const { error } = await auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.code === "same_password" ? "Escolha uma senha diferente da anterior." : "Não foi possível alterar a senha. Solicite um novo link e tente novamente." };
  const { error: signOutError } = await auth.signOut({ scope: "local" });
  if (signOutError) return { error: "Senha alterada. Não foi possível encerrar a sessão; saia da conta antes de entrar novamente." };
  return { success: true };
}
