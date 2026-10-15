import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";

export function createAvatarAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("avatar_backend_unconfigured");
  const url = getSupabaseUrl();
  if (key.startsWith("eyJ")) {
    let claims: { ref?: string; role?: string };
    try { claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()); }
    catch { throw new Error("avatar_backend_unconfigured"); }
    if (claims.role !== "service_role" || claims.ref !== new URL(url).hostname.split(".")[0]) {
      throw new Error("avatar_backend_unconfigured");
    }
  } else if (!key.startsWith("sb_secret_")) throw new Error("avatar_backend_unconfigured");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
