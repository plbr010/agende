import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const coreFields = "full_name, email, phone, intended_use";

/** Optional profile metadata must not make authentication depend on its rollout. */
export async function loadSessionProfile(client: SupabaseClient<Database>, userId: string) {
  const result = await client.from("profiles")
    .select("full_name, email, phone, intended_use, residence_city, avatar_path")
    .eq("user_id", userId).maybeSingle();

  // PostgreSQL undefined_column only: never hide RLS, network or other errors.
  if (result.error?.code !== "42703" ||
      !/\b(residence_city|avatar_path)\b/.test(result.error.message)) return { ...result, metadataAvailable: true };

  const legacy = await client.from("profiles").select(coreFields)
    .eq("user_id", userId).maybeSingle();
  return { ...legacy, data: legacy.data ? {
    ...legacy.data, residence_city: null, avatar_path: null,
  } : null, metadataAvailable: false };
}
