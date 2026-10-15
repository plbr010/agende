import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { normalizeRasterImage } from "@/lib/client/avatar-image";

type Client = SupabaseClient<Database>;
export async function cleanupWorkspaceImages(client: Client, storage: Client, workspaceId: string) {
  const { data: paths, error } = await client.rpc("claim_workspace_image_cleanup", { p_workspace_id: workspaceId });
  if (error) return false;
  let complete = true;
  for (const path of paths ?? []) {
    const removed = await storage.storage.from("workspace-logos").remove([path]);
    if (removed.error) { complete = false; continue; }
    const finished = await client.rpc("finish_workspace_image_cleanup", { p_workspace_id: workspaceId, p_path: path });
    if (finished.error) complete = false;
  }
  return complete;
}

/** Caller verifies confirmed user/manager and explicit public-image consent. */
export async function saveWorkspaceImage(client: Client, storage: Client, workspaceId: string,
  kind: "logo" | "cover", currentPath: string | null, file: File | null) {
  let next: string | null = null;
  if (file) {
    const bytes = await normalizeRasterImage(new Uint8Array(await file.arrayBuffer()), kind === "cover" ? 2048 : 512);
    next = `${workspaceId}/${kind}/${randomUUID()}.webp`;
    const lease = await client.rpc("queue_workspace_image_upload", { p_workspace_id: workspaceId, p_kind: kind, p_path: next });
    if (lease.error) throw new Error(lease.error.message.includes("workspace_subscription_inactive") ? "workspace_subscription_inactive" : "image_backend_unavailable");
    const upload = await storage.storage.from("workspace-logos").upload(next, bytes,
      { contentType: "image/webp", cacheControl: "0", upsert: false });
    if (upload.error) throw new Error("image_upload_failed");
  }
  const swap = await client.rpc("swap_workspace_image", {
    p_workspace_id: workspaceId, p_kind: kind, p_expected_path: currentPath, p_new_path: next,
  });
  // Transport failures can occur after commit. Never remove bytes on an uncertain response.
  // The lease/queue reaps only unreferenced uploads; compare-and-swap prevents lost updates.
  if (swap.error) throw new Error(swap.error.message.includes("workspace_subscription_inactive") ? "workspace_subscription_inactive" : "image_save_failed");
  if (!swap.data) throw new Error("image_changed_retry");
  return { path: next, cleanupPending: !await cleanupWorkspaceImages(client, storage, workspaceId) };
}
