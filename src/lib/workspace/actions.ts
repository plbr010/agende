"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/auth/actions";
import { requireConfirmedSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/http/origin";
import { invitePath, publicProfilePath } from "@/lib/workspace/slug";
import { isManagerRole } from "@/lib/workspace/queries";
import {
  LOGO_MAX_BYTES,
  LOGO_MIME_TYPES,
  logoExtension,
  parseInviteForm,
  parseWorkspaceSettingsForm,
} from "@/lib/workspace/validation";
import type { MemberRole } from "@/lib/workspace/labels";

function fieldErrorsFromZod(error: {
  issues: ReadonlyArray<{ path: readonly PropertyKey[]; message: string }>;
}) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function mapWorkspaceError(message: string): string {
  if (message.includes("not_authorized") || message.includes("42501")) {
    return "Você não tem permissão para esta ação.";
  }
  if (message.includes("reserved_slug")) {
    return "Este endereço público é reservado. Escolha outro.";
  }
  if (message.includes("slug_taken") || message.includes("23505")) {
    return "Este endereço público já está em uso.";
  }
  if (message.includes("invalid_slug")) {
    return "Use letras minúsculas, números e hífen, sem espaços.";
  }
  if (message.includes("invalid_workspace_name")) {
    return "Informe um nome de 2 a 80 caracteres.";
  }
  if (message.includes("invalid_phone")) {
    return "Informe um telefone brasileiro válido, com DDD.";
  }
  if (message.includes("invalid_logo_path")) {
    return "A imagem precisa pertencer a este estabelecimento.";
  }
  if (message.includes("last_owner_protected")) {
    return "O estabelecimento precisa continuar com um dono ativo.";
  }
  if (message.includes("owner_transfer_not_supported") || message.includes("invalid_invite_role")) {
    return "Não é possível convidar ou promover alguém a dono nesta etapa.";
  }
  if (message.includes("plan_professional_limit_reached")) {
    return "Não há vaga de profissional neste plano.";
  }
  if (message.includes("member_not_found")) {
    return "Membro não encontrado neste estabelecimento.";
  }
  if (message.includes("invite_not_found")) {
    return "Convite não encontrado.";
  }
  if (message.includes("invite_email_mismatch")) {
    return "Este convite está vinculado a outro e-mail.";
  }
  if (message.includes("invite_expired")) {
    return "Este convite expirou.";
  }
  if (message.includes("invite_revoked")) {
    return "Este convite foi revogado.";
  }
  if (message.includes("invite_already_accepted")) {
    return "Este convite já foi utilizado.";
  }
  if (message.includes("already_a_member")) {
    return "Você já faz parte deste estabelecimento.";
  }
  if (message.includes("email_not_confirmed")) {
    return "Confirme seu e-mail para continuar.";
  }
  return "Não foi possível concluir. Tente novamente.";
}

async function requireManagedWorkspace() {
  const session = await requireConfirmedSession("/app/configuracoes");
  const workspace = session.workspaces[0];
  if (!workspace) {
    return { error: "Nenhum negócio encontrado." as const, session, workspace: null };
  }
  if (!isManagerRole(workspace.role)) {
    return {
      error: "Somente dono ou admin pode alterar estas configurações." as const,
      session,
      workspace,
    };
  }
  return { error: null, session, workspace };
}

function revalidateWorkspace(slug?: string) {
  revalidatePath("/app");
  revalidatePath("/app/equipe");
  revalidatePath("/app/configuracoes");
  revalidatePath("/app/configuracoes/geral");
  revalidatePath("/app/configuracoes/perfil");
  revalidatePath("/app/configuracoes/equipe");
  revalidatePath("/app/configuracoes/assinatura");
  if (slug) {
    revalidatePath(publicProfilePath(slug));
  }
}

export async function saveWorkspaceSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseWorkspaceSettingsForm(formData);
  if (!parsed.success) {
    return { error: "Revise os campos destacados.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const { error, workspace } = await requireManagedWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }

  const supabase = await createClient();
  const logo = formData.get("logo");
  let logoPath: string | null = null;
  const clearLogo = Boolean(parsed.data.clearLogo);

  if (logo instanceof File && logo.size > 0) {
    if (logo.size > LOGO_MAX_BYTES) {
      return { error: "A imagem pode ter no máximo 2 MB." };
    }
    if (!(LOGO_MIME_TYPES as readonly string[]).includes(logo.type)) {
      return { error: "Use uma imagem JPEG, PNG ou WebP. SVG não é permitido." };
    }
    const ext = logoExtension(logo.type);
    if (!ext) {
      return { error: "Use uma imagem JPEG, PNG ou WebP." };
    }
    logoPath = `${workspace.id}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("workspace-logos")
      .upload(logoPath, logo, { upsert: true, contentType: logo.type });
    if (uploadError) {
      return { error: "Não foi possível enviar a imagem. Tente novamente." };
    }
  }

  const { error: rpcError } = await supabase.rpc("update_workspace_settings", {
    p_workspace_id: workspace.id,
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_business_phone: parsed.data.businessPhone,
    p_business_email: parsed.data.businessEmail,
    p_description: parsed.data.description,
    p_address: parsed.data.address,
    p_city: parsed.data.city,
    p_state: parsed.data.state,
    p_postal_code: parsed.data.postalCode,
    p_instagram: parsed.data.instagram,
    p_timezone: parsed.data.timezone,
    p_logo_path: logoPath,
    p_clear_logo: clearLogo && !logoPath,
  });

  if (rpcError) {
    return { error: mapWorkspaceError(rpcError.message) };
  }

  revalidateWorkspace(parsed.data.slug);
  return { success: "Configurações salvas." };
}

export type InviteActionState = ActionState & {
  inviteLink?: string;
  emailBound?: boolean;
};

export async function createTeamInviteAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const parsed = parseInviteForm(formData);
  if (!parsed.success) {
    return { error: parsed.error, fieldErrors: parsed.fieldErrors };
  }

  const { error, workspace } = await requireManagedWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }

  const supabase = await createClient();
  const { data, error: rpcError } = await supabase.rpc("create_workspace_invite", {
    p_workspace_id: workspace.id,
    p_role: parsed.data.role,
    p_email: parsed.data.email ?? undefined,
  });

  if (rpcError || !data || typeof data !== "object") {
    return { error: mapWorkspaceError(rpcError?.message ?? "") };
  }

  const payload = data as { token?: unknown };
  const token = typeof payload.token === "string" ? payload.token : null;
  if (!token) {
    return { error: "O convite foi criado, mas o link não pôde ser exibido. Gere outro." };
  }

  const origin = await getRequestOrigin();
  revalidateWorkspace(workspace.slug);
  return {
    success: parsed.data.email
      ? "Convite gerado. Copie o link e envie para o e-mail informado."
      : "Link secreto gerado. Copie agora; ele não aparece de novo.",
    inviteLink: `${origin}${invitePath(token)}`,
    emailBound: Boolean(parsed.data.email),
  };
}

export async function revokeTeamInviteAction(formData: FormData): Promise<ActionState> {
  const { error, workspace } = await requireManagedWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const inviteId = String(formData.get("inviteId") ?? "");
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("revoke_workspace_invite", {
    p_workspace_id: workspace.id,
    p_invite_id: inviteId,
  });
  if (rpcError) {
    return { error: mapWorkspaceError(rpcError.message) };
  }
  revalidateWorkspace(workspace.slug);
  return { success: "Convite revogado." };
}

async function mutateMember(
  formData: FormData,
  run: (
    supabase: Awaited<ReturnType<typeof createClient>>,
    workspaceId: string,
    memberId: string,
  ) => Promise<{ error: { message: string } | null }>,
  success: string,
): Promise<ActionState> {
  const { error, workspace } = await requireManagedWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const memberId = String(formData.get("memberId") ?? "");
  const supabase = await createClient();
  const { error: rpcError } = await run(supabase, workspace.id, memberId);
  if (rpcError) {
    return { error: mapWorkspaceError(rpcError.message) };
  }
  revalidateWorkspace(workspace.slug);
  return { success };
}

export async function deactivateMemberAction(formData: FormData): Promise<ActionState> {
  return mutateMember(
    formData,
    async (supabase, workspaceId, memberId) => {
      const { error } = await supabase.rpc("deactivate_workspace_member", {
        p_workspace_id: workspaceId,
        p_member_id: memberId,
      });
      return { error };
    },
    "Membro desativado.",
  );
}

export async function reactivateMemberAction(formData: FormData): Promise<ActionState> {
  return mutateMember(
    formData,
    async (supabase, workspaceId, memberId) => {
      const { error } = await supabase.rpc("reactivate_workspace_member", {
        p_workspace_id: workspaceId,
        p_member_id: memberId,
      });
      return { error };
    },
    "Membro reativado.",
  );
}

export async function removeMemberAction(formData: FormData): Promise<ActionState> {
  return mutateMember(
    formData,
    async (supabase, workspaceId, memberId) => {
      const { error } = await supabase.rpc("remove_workspace_member", {
        p_workspace_id: workspaceId,
        p_member_id: memberId,
      });
      return { error };
    },
    "Membro removido.",
  );
}

export async function updateMemberRoleAction(formData: FormData): Promise<ActionState> {
  const { error, workspace } = await requireManagedWorkspace();
  if (error || !workspace) {
    return { error: error ?? "Nenhum negócio encontrado." };
  }
  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role") ?? "") as MemberRole;
  if (role !== "admin" && role !== "professional" && role !== "receptionist") {
    return { error: "Papel inválido." };
  }
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("update_workspace_member_role", {
    p_workspace_id: workspace.id,
    p_member_id: memberId,
    p_role: role,
  });
  if (rpcError) {
    return { error: mapWorkspaceError(rpcError.message) };
  }
  revalidateWorkspace(workspace.slug);
  return { success: "Papel atualizado." };
}

export async function acceptInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const next = invitePath(token);
  const session = await requireConfirmedSession(next);
  if (!session.context.emailConfirmed) {
    redirect("/verificar-email");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_workspace_invite", { p_token: token });
  if (error) {
    return { error: mapWorkspaceError(error.message) };
  }
  revalidatePath("/app");
  revalidatePath("/app/equipe");
  redirect("/app");
}
