import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAvatarAdmin } from "@/lib/supabase/avatar-admin";
import { AVATAR_INPUT_LIMIT, normalizeAvatar } from "@/lib/client/avatar-image";
import { getRequestOrigin } from "@/lib/http/origin";

export const runtime = "nodejs";
const BUCKET = "account-avatars";
const noStore = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const error = (code: string, status: number) => Response.json({ error: code }, { status, headers: noStore });
function backendFailure(cause: unknown) {
  const code = cause instanceof Error && ["profile_unavailable", "avatar_backend_unconfigured"].includes(cause.message)
    ? cause.message : "backend_unavailable";
  console.error("account_avatar_backend_failed", { code });
  return error("avatar_backend_unavailable", 503);
}

async function account() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email_confirmed_at) return null;
  const { data: profile, error: profileError } = await client.from("profiles")
    .select("avatar_path").eq("user_id", user.id).single();
  if (profileError || !profile) {
    console.error("account_avatar_profile_failed", { code: profileError?.code ?? "profile_missing" });
    throw new Error("profile_unavailable");
  }
  return { user, path: profile.avatar_path };
}

async function cleanup(admin: ReturnType<typeof createAvatarAdmin>) {
  const { data, error: queueError } = await admin.rpc("list_avatar_cleanup");
  if (queueError) return false;
  let complete = true;
  for (const path of data ?? []) {
    const { error: removalError } = await admin.storage.from(BUCKET).remove([path]);
    if (removalError) { complete = false; continue; }
    const { error: finishError } = await admin.rpc("finish_avatar_cleanup", { p_path: path });
    if (finishError) complete = false;
  }
  return complete;
}

export async function GET() {
  try {
    const current = await account();
    if (!current) return error("auth_required", 401);
    if (!current.path) return new Response(null, { status: 204, headers: noStore });
    const admin = createAvatarAdmin();
    const { data, error: downloadError } = await admin.storage.from(BUCKET).download(current.path);
    if (downloadError || !data) return error("avatar_unavailable", 503);
    // Authenticated proxy avoids transferable signed URLs, with authorization on every read.
    return new Response(data, { headers: { ...noStore, "Content-Type": "image/webp" } });
  } catch (cause) { return backendFailure(cause); }
}

async function mutate(request: Request, remove: boolean) {
  // Cookie-authenticated endpoint: explicit same-origin CSRF check, no user/path parameters.
  if (request.headers.get("origin") !== await getRequestOrigin()) return error("origin_denied", 403);
  try {
    const current = await account();
    if (!current) return error("auth_required", 401);
    const admin = createAvatarAdmin();
    await cleanup(admin);
    let next: string | null = null;
    if (!remove) {
      const length = Number(request.headers.get("content-length"));
      if (length > AVATAR_INPUT_LIMIT || !request.body) return error("image_size_invalid", 413);
      // Read raw body with a strict cap, including requests with no Content-Length.
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const chunk = await reader.read(); if (chunk.done) break;
        size += chunk.value.length;
        if (size > AVATAR_INPUT_LIMIT) { await reader.cancel(); return error("image_size_invalid", 413); }
        chunks.push(chunk.value);
      }
      let bytes: Buffer;
      try { bytes = await normalizeAvatar(Buffer.concat(chunks)); }
      catch { return error("image_invalid", 422); }
      next = `avatars/${current.user.id}/${randomUUID()}.webp`;
      const { error: leaseError } = await admin.rpc("queue_account_avatar_upload", { p_user_id: current.user.id, p_path: next });
      if (leaseError) return error("avatar_save_failed", 503);
      const { error: uploadError } = await admin.storage.from(BUCKET).upload(next, bytes,
        { contentType: "image/webp", cacheControl: "0", upsert: false });
      if (uploadError) return error("avatar_upload_failed", 503);
    }
    const { data: swapped, error: swapError } = await admin.rpc("swap_account_avatar", {
      p_user_id: current.user.id, p_expected_path: current.path, p_new_path: next,
    });
    if (swapError || !swapped) {
      // A transport error can arrive after the database committed. Keep the lease:
      // cleanup excludes referenced paths and safely reaps uncommitted uploads.
      if (next && !swapError) {
        const { error: removalError } = await admin.storage.from(BUCKET).remove([next]);
        if (!removalError) await admin.rpc("finish_avatar_cleanup", { p_path: next });
      }
      return error(swapError ? "avatar_save_failed" : "avatar_changed_retry", swapError ? 503 : 409);
    }
    const cleaned = await cleanup(admin);
    revalidatePath("/cliente", "layout"); revalidatePath("/app", "layout");
    return Response.json({ avatarUrl: next ? "/api/account/avatar" : null, cleanupPending: !cleaned }, { headers: noStore });
  } catch (cause) { return backendFailure(cause); }
}
export async function PUT(request: Request) { return mutate(request, false); }
export async function DELETE(request: Request) { return mutate(request, true); }
