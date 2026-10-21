"use server";

import { parsePlanId, planSchema, type PlanId } from "@/lib/billing/plans";
import { parseSignupJourney, type SignupJourney } from "@/lib/auth/signup-journey";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDefaultDestination, sanitizeNextPath } from "@/lib/auth/redirects";
import { loadAppSession } from "@/lib/auth/session";
import { getRequestOrigin } from "@/lib/http/origin";
import { normalizeEmail } from "@/lib/validation/email";
import { loginSchema, parseSignupForm } from "@/lib/validation/signup";

const PENDING_EMAIL_COOKIE = "agende_pending_email";
const PENDING_NEXT_COOKIE = "agende_pending_next";
const PENDING_INTENT_COOKIE = "agende_pending_intent";
const RESEND_AT_COOKIE = "agende_resend_at";
const SELECTED_PLAN_COOKIE = "agende_selected_plan";
const PENDING_JOURNEY_COOKIE = "agende_pending_journey";
const RESEND_COOLDOWN_MS = 60_000;

async function resolveOrigin(): Promise<string> {
  return getRequestOrigin();
}

async function setPendingIntent(intent: "client" | "professional") {
  const store = await cookies();
  store.set(PENDING_INTENT_COOKIE, intent, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function getPendingIntent(): Promise<"client" | "professional" | null> {
  const store = await cookies();
  const value = store.get(PENDING_INTENT_COOKIE)?.value;
  return value === "client" || value === "professional" ? value : null;
}

async function setPendingEmail(email: string, next?: string | null) {
  const store = await cookies();
  store.set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  const safeNext = sanitizeNextPath(next);
  if (safeNext) {
    store.set(PENDING_NEXT_COOKIE, safeNext, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
  } else {
    store.delete(PENDING_NEXT_COOKIE);
  }
}

export async function getPendingEmail(): Promise<string | null> {
  const store = await cookies();
  return store.get(PENDING_EMAIL_COOKIE)?.value ?? null;
}

export async function getPendingNext(): Promise<string | null> {
  const store = await cookies();
  return sanitizeNextPath(store.get(PENDING_NEXT_COOKIE)?.value);
}

export async function getSelectedPlan(): Promise<PlanId | null> {
  const store = await cookies();
  return parsePlanId(store.get(SELECTED_PLAN_COOKIE)?.value);
}

async function setPendingJourney(journey: SignupJourney) {
  const store = await cookies();
  store.set(PENDING_JOURNEY_COOKIE, journey, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function getPendingJourney(): Promise<SignupJourney | null> {
  const store = await cookies();
  const value = store.get(PENDING_JOURNEY_COOKIE)?.value;
  if (value === "client" || value === "owner" || value === "team") return value;
  return null;
}

export async function clearPendingJourney() {
  const store = await cookies();
  store.delete(PENDING_JOURNEY_COOKIE);
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
  subscriptionInactive?: boolean;
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

  let input = parsed.data;
  const requestedJourney = formData.get("journey");
  let journey = parseSignupJourney(requestedJourney, input.intendedUse);
  const next = sanitizeNextPath(String(formData.get("next") ?? ""));
  if (requestedJourney === "team") {
    if (!next?.startsWith("/convite/")) {
      return { error: "Cole um convite válido antes de criar a conta." };
    }
    input = { ...input, intendedUse: "client" };
    journey = "team";
  } else if (requestedJourney === "client" && input.intendedUse !== "client") {
    return { error: "A conta de cliente não inclui plano." };
  } else if (requestedJourney === "owner" && input.intendedUse !== "professional") {
    return { error: "Escolha a conta do salão para continuar." };
  }
  const supabase = await createClient();
  const origin = await resolveOrigin();
  const emailRedirectTo = next
    ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    : `${origin}/auth/callback`;

  const { data, error } = await supabase.auth.signUp({
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

  // GoTrue can obscure an existing confirmed account with an empty-identity
  // user and no error. That does not mean a new confirmation email was sent.
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: "Não foi possível iniciar um novo cadastro. Se você já tem conta, entre ou recupere o acesso." };
  }

  await setPendingEmail(input.email, next);
  await setPendingIntent(input.intendedUse);
  await setPendingJourney(journey);
  const selectedPlan = parsePlanId(formData.get("plan"));
  if (journey === "owner" && selectedPlan && input.intendedUse === "professional") {
    await setSelectedPlanCookie(selectedPlan);
  } else {
    const store = await cookies();
    store.delete(SELECTED_PLAN_COOKIE);
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
      await setPendingEmail(email, String(formData.get("next") ?? ""));
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
  const pendingNext = sanitizeNextPath(store.get(PENDING_NEXT_COOKIE)?.value);
  const emailRedirectTo = pendingNext
    ? `${origin}/auth/callback?next=${encodeURIComponent(pendingNext)}`
    : `${origin}/auth/callback`;
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo },
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

export async function selectOnboardingPlanAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const plan = planSchema.safeParse(formData.get("plan"));
  if (!plan.success) return { error: "Escolha um plano válido." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");
  if (!user.email_confirmed_at) redirect("/verificar-email");
  await setSelectedPlanCookie(plan.data);
  redirect("/onboarding?etapa=salao");
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
