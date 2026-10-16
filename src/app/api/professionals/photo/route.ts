import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAvatarAdmin } from "@/lib/supabase/avatar-admin";
import { normalizeAvatar } from "@/lib/client/avatar-image";
import { getRequestOrigin } from "@/lib/http/origin";
import { imageHeaders, readImageBody } from "@/lib/media/http";

export const runtime = "nodejs";
const BUCKET = "professional-photos";
const fail = (status: number) => Response.json({ error: "photo_unavailable" }, { status, headers: imageHeaders });
function memberId(request: Request) { return z.string().uuid().safeParse(new URL(request.url).searchParams.get("memberId")); }

export async function GET(request: Request) {
  const id = memberId(request); if (!id.success) return fail(400);
  try {
    const client = await createClient();
    const slug = new URL(request.url).searchParams.get("slug");
    if (slug && !/^[a-z0-9-]{1,100}$/.test(slug)) return fail(400);
    const { data: path, error } = await client.rpc("get_professional_photo", { p_member_id: id.data, ...(slug ? { p_slug: slug } : {}) });
    if (error || !path) return fail(404);
    const result = await createAvatarAdmin().storage.from(BUCKET).download(path);
    if (result.error || !result.data) return fail(503);
    return new Response(result.data, { headers: { ...imageHeaders, "Content-Type": "image/webp" } });
  } catch { return fail(503); }
}
async function mutate(request: Request, remove: boolean) {
  const id = memberId(request); if (!id.success) return fail(400);
  try {
    if (request.headers.get("origin") !== await getRequestOrigin()) return fail(403);
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user?.email_confirmed_at) return fail(401);
    // RLS first, before opening the privileged Storage client.
    const { data: profile } = await client.from("professional_profiles").select("workspace_id, photo_path").eq("member_id", id.data).maybeSingle();
    if (!profile) return fail(404);
    const { data: members } = await client.from("workspace_members").select("id, role, status").eq("workspace_id", profile.workspace_id).eq("user_id", user.id).eq("status", "active");
    const actor = members?.[0];
    if (!actor || !(actor.role === "owner" || actor.role === "admin" || (actor.role === "professional" && actor.id === id.data))) return fail(403);
    if (!remove && request.headers.get("x-public-photo-consent") !== "true") return fail(400);
    if (!remove && (!['image/jpeg', 'image/png', 'image/webp'].includes(request.headers.get('content-type') ?? '') ||
      !['jpg','jpeg','png','webp'].includes(request.headers.get('x-image-extension') ?? ''))) return fail(422);
    const bytes = remove ? null : await normalizeAvatar(await readImageBody(request));
    const admin = createAvatarAdmin();
    const next = bytes ? `${profile.workspace_id}/professionals/${id.data}/${randomUUID()}.webp` : null;
    if (next && bytes) {
      const lease = await admin.rpc("queue_professional_photo", { p_actor_id: user.id, p_member_id: id.data, p_path: next });
      if (lease.error) return fail(403);
      const upload = await admin.storage.from(BUCKET).upload(next, bytes, { contentType: "image/webp", cacheControl: "0", upsert: false });
      if (upload.error) return fail(503);
    }
    const swap = await admin.rpc("swap_professional_photo", { p_actor_id: user.id, p_member_id: id.data, p_expected_path: profile.photo_path, p_new_path: next });
    // Keep bytes on uncertain acknowledgement: cleanup excludes current references.
    if (swap.error || !swap.data) return fail(swap.error ? 503 : 409);
    const claim = await admin.rpc("claim_professional_photo_cleanup", { p_member_id: id.data });
    let cleanupPending = Boolean(claim.error);
    for (const path of claim.data ?? []) {
      const removed = await admin.storage.from(BUCKET).remove([path]);
      if (removed.error) { cleanupPending = true; continue; }
      const finished = await admin.rpc("finish_professional_photo_cleanup", { p_path: path });
      if (finished.error) cleanupPending = true;
    }
    revalidatePath("/app", "layout"); revalidatePath("/p", "layout");
    return Response.json({ hasPhoto: Boolean(next), cleanupPending }, { headers: imageHeaders });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return fail(code === "image_size_invalid" ? 413 : code === "image_invalid" ? 422 : 503);
  }
}
export async function PUT(request: Request) { return mutate(request, false); }
export async function DELETE(request: Request) { return mutate(request, true); }
