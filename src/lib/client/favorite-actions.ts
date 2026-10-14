"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function changeWorkspaceFavorite(workspaceId: string, add: boolean) {
  if (!z.string().uuid().safeParse(workspaceId).success || typeof add !== "boolean") return { error: "invalid_input" };
  const client = await createClient();
  const { error } = await client.rpc(add ? "add_my_workspace_favorite" : "remove_my_workspace_favorite", { p_workspace_id: workspaceId });
  if (error) return { error: error.message.includes("workspace_unavailable") ? "workspace_unavailable" : "favorites_unavailable" };
  revalidatePath("/cliente"); revalidatePath("/cliente/favoritos");
  return { success: true };
}

export async function loadWorkspaceFavorites() {
  const client = await createClient();
  const { data, error } = await client.rpc("list_my_workspace_favorites");
  if (error) return { data: null, error: "favorites_unavailable" };
  return { data, error: null };
}
