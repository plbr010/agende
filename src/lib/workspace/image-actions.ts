"use server";

import { revalidatePath } from "next/cache";
import { requireConfirmedSession } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { createAvatarAdmin } from "@/lib/supabase/avatar-admin";
import { AVATAR_INPUT_LIMIT } from "@/lib/client/avatar-image";
import { saveWorkspaceImage } from "@/lib/workspace/images";
import { isManagerRole } from "@/lib/workspace/queries";
import { inactiveWorkspaceMessage } from "@/lib/workspace/settings-errors";

export async function saveWorkspaceImageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireConfirmedSession("/app/configuracoes/perfil");
  const workspace = session.workspaces[0];
  if (!workspace || !isManagerRole(workspace.role)) return { error: "Somente dono ou admin pode editar as imagens do estabelecimento." };
  const kind = form.get("kind");
  if (kind !== "logo" && kind !== "cover") return { error: "Escolha logo ou capa." };
  const remove = form.get("remove") === "true";
  const file = form.get("image");
  if (!remove && (!(file instanceof File) || !file.size)) return { error: "Escolha uma imagem." };
  if (!remove && form.get("publicConsent") !== "true") return { error: "Confirme que esta imagem pode aparecer no perfil público do estabelecimento." };
  if (!remove && file instanceof File && file.size > AVATAR_INPUT_LIMIT) return { error: "A imagem pode ter no máximo 4 MB." };
  const client = await createClient();
  const { data, error } = await client.from("workspace_settings").select("logo_path, cover_path").eq("workspace_id", workspace.id).single();
  if (error || !data) return { error: "As imagens do estabelecimento ainda não estão disponíveis neste ambiente." };
  try {
    const saved = await saveWorkspaceImage(client, createAvatarAdmin(), workspace.id, kind,
      kind === "logo" ? data.logo_path : data.cover_path, remove ? null : file as File);
    revalidatePath("/app/configuracoes/perfil");revalidatePath(`/p/${workspace.slug}`);
    return { success: saved.cleanupPending ? "Imagem salva. A limpeza da imagem anterior está pendente." : remove ? "Imagem removida." : "Imagem pública salva." };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "workspace_subscription_inactive") return { error: inactiveWorkspaceMessage, subscriptionInactive: true };
    if (code === "image_invalid" || code === "image_size_invalid") return { error: "Use uma imagem JPEG, PNG ou WebP válida, até 4 MB e 4096 × 4096 pixels." };
    if (code === "image_changed_retry") return { error: "A imagem mudou em outra janela. Atualize a página e tente novamente." };
    // Fixed operation/code only; no file content, credentials or provider payload.
    console.error("workspace_image_save_failed", { code: ["image_backend_unavailable","image_upload_failed","image_save_failed","avatar_backend_unconfigured"].includes(code) ? code : "backend_unavailable" });
    return { error: "Não foi possível persistir a imagem. Tente novamente ou contate o suporte." };
  }
}
