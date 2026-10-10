"use server";

import { parsePlanId, planSchema, type PlanId } from "@/lib/billing/plans";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDefaultDestination, sanitizeNextPath } from "@/lib/auth/redirects";
import { loadAppSession } from "@/lib/auth/session";
import { getRequestOrigin } from "@/lib/http/origin";
import { normalizeEmail } from "@/lib/validation/email";
import { loginSchema, parseSignupForm } from "@/lib/validation/signup";

const PENDING_EMAIL_COOKIE = "agende_pending_email";
const RESEND_AT_COOKIE = "agende_resend_at";
const SELECTED_PLAN_COOKIE = "agende_selected_plan";
const RESEND_COOLDOWN_MS = 60_000;

async function resolveOrigin(): Promise<string> {
  return getRequestOrigin();
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

export async function getSelectedPlan(): Promise<PlanId | null> {
  const store = await cookies();
  return parsePlanId(store.get(SELECTED_PLAN_COOKIE)?.value);
}

async function setSelectedPlanCookie(plan: PlanId) {
  const store = await cookies();
  store.set(SELECTED_PLAN_COOKIE, plan, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
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
    return { error: "Confira os campos em vermelho.", fieldErrors };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const origin = await resolveOrigin();
  const next = sanitizeNextPath(String(formData.get("next") ?? ""));
  const emailRedirectTo = next
    ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    : `${origin}/auth/callback`;

  const { error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo,
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
    if (error.code === "user_already_exists" || error.message.toLowerCase().includes("already registered")) {
      return { error: "Este e-mail já possui uma conta. Entre ou recupere o acesso." };
    }
    return { error: "Não foi possível criar sua conta. Tente novamente." };
  }

  await setPendingEmail(input.email);
  const selectedPlan = parsePlanId(formData.get("plan"));
  if (selectedPlan && input.intendedUse === "professional") {
    await setSelectedPlanCookie(selectedPlan);
  }
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
    return { error: "Não foi possível entrar. Tente novamente." };
  }
  const next = sanitizeNextPath(String(formData.get("next") ?? ""));
  redirect(next ?? getDefaultDestination(session.context));
}

export async function signOutAction() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error("Não foi possível encerrar sua sessão. Tente novamente.");
  }
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
  const plan = planSchema.safeParse(formData.get("plan"));
  if (!plan.success) return { error: "Escolha um plano válido." };
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) {
    return { error: "Informe o nome do salão ou estúdio (2 a 80 caracteres).", fieldErrors: { name: "Nome inválido." } };
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

  const { error } = await supabase.rpc("create_workspace", { p_name: name, p_plan: plan.data });
  if (error) {
    if (error.message.includes("email_not_confirmed")) {
      redirect("/verificar-email");
    }
    if (error.message.includes("invalid_workspace_name")) {
      return { error: "Nome do salão inválido." };
    }
    return { error: "Não foi possível criar o salão. Tente novamente." };
  }

  redirect("/app?setup=1");
}

export async function enableClientProfileAction(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_client_profile");
  if (error) {
    redirect("/app?clientError=1");
  }
  redirect("/cliente");
}
