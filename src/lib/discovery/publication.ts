"use server";

import { revalidatePath } from "next/cache";
import { requireConfirmedSession, requireActiveWorkspace } from "@/lib/auth/session";
import { isManagerRole } from "@/lib/workspace/queries";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/auth/actions";

export async function setDiscoveryPublicationAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireConfirmedSession("/app/configuracoes/perfil");
  const workspace = requireActiveWorkspace(session);
  if (!isManagerRole(workspace.role)) return { error: "Somente dono ou admin pode publicar o salão." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_workspace_discovery", {
    p_workspace_id: workspace.id,
    p_enabled: form.get("enabled") === "on",
  });
  if (error) {
    const message = error.message ?? "";
    if (error.code === "PGRST202" || error.code === "42883" || message.includes("could not find the function")) {
      return { error: "A publicação na busca ainda não está disponível neste ambiente." };
    }
    if (message.includes("discovery_locality_required")) {
      return { error: "Preencha cidade e estado nas configurações gerais antes de publicar." };
    }
    return { error: "Não foi possível atualizar a publicação. Verifique sua assinatura e tente novamente." };
  }
  revalidatePath("/app/configuracoes/perfil");
  return { success: "Publicação atualizada." };
}
