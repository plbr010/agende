"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDefaultDestination } from "@/lib/auth/redirects";
import { loadAppSession } from "@/lib/auth/session";
import { getSiteUrl } from "@/lib/supabase/env";
import { normalizeEmail } from "@/lib/validation/email";
import { loginSchema, parseSignupForm } from "@/lib/validation/signup";

const PENDING_EMAIL_COOKIE = "agende_pending_email";
const RESEND_AT_COOKIE = "agende_resend_at";
const RESEND_COOLDOWN_MS = 60_000;

async function resolveOrigin(): Promise<string> {
  const hdrs = await headers();
  const forwardedHost = hdrs.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    return `${proto}://${forwardedHost}`;
  }
  return hdrs.get("origin") ?? getSiteUrl();
}

async function setPendingEmail(email: string) {
  const store = await cookies();
  store.set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function getPendingEmail(): Promise<string | null> {
  const store = await cookies();
  return store.get(PENDING_EMAIL_COOKIE)?.value ?? null;
}

export type ActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseSignupForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { error: "Revise os campos destacados.", fieldErrors };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const origin = await resolveOrigin();

  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        full_name: input.fullName,
        phone: input.phone,
        intended_use: input.intendedUse,
        terms_accepted: true,
        privacy_accepted: true,
      },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered") || error.status === 422) {
      return { error: "Este e-mail já possui uma conta. Entre ou recupere o acesso." };
    }
    return { error: "Não foi possível criar sua conta. Tente novamente." };
  }

  await setPendingEmail(input.email);
  redirect(`/verificar-email?status=sent`);
}

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const email = normalizeEmail(parsed.data.email);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("email not confirmed")) {
      await setPendingEmail(email);
      redirect("/verificar-email?status=unconfirmed");
    }
    return { error: "E-mail ou senha incorretos." };
  }

  const session = await loadAppSession();
  if (!session) {
    return { error: "Não foi possível autenticar. Tente novamente." };
  }
  redirect(getDefaultDestination(session.context));
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function resendConfirmationAction(): Promise<ActionState> {
  const store = await cookies();
  const email = store.get(PENDING_EMAIL_COOKIE)?.value;
  if (!email) {
    return { error: "Não encontramos um cadastro pendente neste dispositivo. Cadastre-se novamente." };
  }

  const last = store.get(RESEND_AT_COOKIE)?.value;
  if (last) {
    const elapsed = Date.now() - Number(last);
    if (Number.isFinite(elapsed) && elapsed < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return { error: `Aguarde ${wait}s para reenviar o e-mail.` };
    }
  }

  const supabase = await createClient();
  const origin = await resolveOrigin();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("rate") || message.includes("security")) {
      return { error: "Muitas tentativas. Aguarde um minuto e tente de novo." };
    }
    return { error: "Não foi possível reenviar agora. Tente novamente em instantes." };
  }

  store.set(RESEND_AT_COOKIE, String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return { success: "Enviamos um novo e-mail de confirmação." };
}

export async function createWorkspaceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return { error: "Informe o nome do negócio (2 a 80 caracteres).", fieldErrors: { name: "Nome inválido." } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  if (!user.email_confirmed_at) {
    redirect("/verificar-email");
  }

  const { error } = await supabase.rpc("create_workspace", { p_name: name });
  if (error) {
    if (error.message.includes("email_not_confirmed")) {
      redirect("/verificar-email");
    }
    if (error.message.includes("invalid_workspace_name")) {
      return { error: "Nome do negócio inválido." };
    }
    return { error: "Não foi possível criar o negócio. Tente novamente." };
  }

  redirect("/app");
}

export async function enableClientProfileAction(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_client_profile");
  if (error) {
    redirect("/app?clientError=1");
  }
  redirect("/cliente");
}
