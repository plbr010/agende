"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAvatarAdmin } from "@/lib/supabase/avatar-admin";
import { adminErrorMessage } from "@/lib/admin/errors";
import { isMasterAdminBootstrapEmail } from "@/lib/admin/bootstrap";
import { requirePlatformAdmin } from "@/lib/admin/guard";
import { sanitizeNextPath } from "@/lib/auth/redirects";
import { loadAppSession } from "@/lib/auth/session";

function adminReturnPath(raw: string): string {
  const sanitized = sanitizeNextPath(raw);
  if (sanitized && (sanitized === "/admin" || sanitized.startsWith("/admin/"))) {
    return sanitized;
  }
  return "/admin";
}

export type AdminActionState = { error?: string; success?: string };

function revalidateAdmin(paths: string[]) {
  for (const path of paths) revalidatePath(path);
}

export async function claimPlatformAdminAction(): Promise<AdminActionState> {
  const session = await loadAppSession();
  if (!session?.context.emailConfirmed) {
    return { error: "Entre com uma conta confirmada para ativar o painel master." };
  }
  if (session.context.isPlatformAdmin) {
    redirect("/admin");
  }
  if (!isMasterAdminBootstrapEmail(session.user.email)) {
    return { error: "Este e-mail não está na lista de provisionamento do painel master." };
  }

  try {
    const admin = createAvatarAdmin();
    const { error } = await admin.rpc("grant_platform_admin", { p_user_id: session.user.id });
    if (error) {
      return { error: adminErrorMessage(error, "Não foi possível ativar o acesso master.") };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("avatar_backend_unconfigured") || message.includes("unconfigured")) {
      return {
        error: "Falta a chave de serviço no servidor. Use SUPABASE_SERVICE_ROLE_KEY ou conceda o acesso via SQL como operador do banco.",
      };
    }
    return { error: "Não foi possível ativar o acesso master agora." };
  }

  revalidateAdmin(["/admin"]);
  redirect("/admin");
}

export async function setAccountHoldAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requirePlatformAdmin("/admin");
  const subjectType = String(formData.get("subjectType") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const active = String(formData.get("active") ?? "") === "true";
  const returnTo = adminReturnPath(String(formData.get("returnTo") ?? "/admin"));

  if ((subjectType !== "user" && subjectType !== "workspace") || !subjectId) {
    return { error: "Não foi possível identificar a conta." };
  }
  if (active && (reason.length < 3 || reason.length > 200)) {
    return { error: "Informe um motivo entre 3 e 200 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_account_hold", {
    p_subject_type: subjectType,
    p_subject_id: subjectId,
    p_reason: reason || (active ? "suspensão" : "reativação"),
    p_active: active,
  });
  if (error) {
    return { error: adminErrorMessage(error, "Não foi possível atualizar a conta.") };
  }

  revalidateAdmin([
    "/admin",
    "/admin/profissionais",
    "/admin/estabelecimentos",
    "/admin/clientes",
    "/admin/suporte",
    returnTo,
  ]);
  return { success: active ? "Conta suspensa." : "Conta reativada." };
}
