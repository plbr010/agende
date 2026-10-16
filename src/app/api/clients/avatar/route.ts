import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAvatarAdmin } from "@/lib/supabase/avatar-admin";
import { imageHeaders } from "@/lib/media/http";
export const runtime = "nodejs";
const missing = () => new Response(null, { status: 404, headers: imageHeaders });
export async function GET(request: Request) {
  const id = z.string().uuid().safeParse(new URL(request.url).searchParams.get("clientId"));
  if (!id.success) return missing();
  try {
    const client = await createClient();
    const { data: path, error } = await client.rpc("get_related_client_avatar", { p_client_id: id.data });
    if (error || !path) return missing();
    const result = await createAvatarAdmin().storage.from("account-avatars").download(path);
    if (result.error || !result.data) return missing();
    return new Response(result.data, { headers: { ...imageHeaders, "Content-Type": "image/webp" } });
  } catch { return missing(); }
}
