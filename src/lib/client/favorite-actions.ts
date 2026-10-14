"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { readPublicWorkspaceId } from "@/lib/client/favorites";
import { createClient } from "@/lib/supabase/server";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);

function favoriteError(message: string) {
  if (message.includes("workspace_unavailable")) return "workspace_unavailable";
  if (message.includes("email_not_confirmed") || message.includes("client_profile_required")) return "favorites_unavailable";
  return "favorites_unavailable";
}

export async function changeWorkspaceFavorite(workspaceId: string, add: boolean) {
  if (!z.string().uuid().safeParse(workspaceId).success || typeof add !== "boolean") return { error: "invalid_input" as const };
  const client = await createClient();
  const { error } = await client.rpc(add ? "add_my_workspace_favorite" : "remove_my_workspace_favorite", { p_workspace_id: workspaceId });
  if (error) return { error: favoriteError(error.message) };
  revalidatePath("/cliente");
  revalidatePath("/cliente/favoritos");
  revalidatePath("/cliente/descobrir");
  return { success: true as const };
}

export async function loadWorkspaceFavorites() {
  const client = await createClient();
  const { data, error } = await client.rpc("list_my_workspace_favorites");
  if (error) return { data: null, error: "favorites_unavailable" as const };
  return { data, error: null };
}

type FavoriteMutation =
  | { success: true; workspaceId: string }
  | { error: "invalid_input" | "workspace_unavailable" | "favorites_unavailable" | "missing_target" };

/** Resolves the id from the public profile payload, then calls the existing favorite RPC. */
export async function savePublicFavorite(slug: string): Promise<FavoriteMutation> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return { error: "invalid_input" as const };
  const client = await createClient();
  const { data, error } = await client.rpc("get_public_workspace_profile", { p_slug: parsed.data });
  if (error || !data) return { error: "workspace_unavailable" as const };
  const workspaceId = readPublicWorkspaceId(data);
  if (!workspaceId) return { error: "missing_target" as const };
  const changed = await changeWorkspaceFavorite(workspaceId, true);
  if ("error" in changed) {
    return { error: changed.error === "invalid_input" ? "invalid_input" : changed.error === "workspace_unavailable" ? "workspace_unavailable" : "favorites_unavailable" };
  }
  return { success: true as const, workspaceId };
}
