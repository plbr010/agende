export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}

export function getSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  return key;
}

export function getSiteUrl(): string {
  const deployed = process.env.VERCEL === "1" || ["production", "preview"].includes(process.env.VERCEL_ENV ?? "");
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const platformHost = process.env.VERCEL_ENV === "preview"
    ? process.env.VERCEL_URL
    : process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const value = configured || (platformHost ? `https://${platformHost}` : deployed ? null : "http://localhost:3000");
  if (!value) throw new Error("Missing site origin configuration");

  const url = new URL(value);
  const localHttp = !deployed && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !localHttp) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Invalid site origin configuration");
  }
  return url.origin;
}
