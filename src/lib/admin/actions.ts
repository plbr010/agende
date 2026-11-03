"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminErrorMessage } from "@/lib/admin/errors";
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
  if (!session.context.isOfficialPlatformOwner) {
    return { error: "Esta identidade autenticada não é a conta master autorizada." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_official_platform_admin");
  if (error) {
    return { error: adminErrorMessage(error, "Não foi possível ativar o acesso master.") };
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
