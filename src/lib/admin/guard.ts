import "server-only";
import { redirect } from "next/navigation";
import { loadAppSession, type AppSession } from "@/lib/auth/session";
import { getDefaultDestination } from "@/lib/auth/redirects";
import { isOfficialMasterAdminEmail } from "./bootstrap";
import { createClient } from "@/lib/supabase/server";
export type PlatformAdminAccess = { session: AppSession; provisionPending: boolean };
export async function requirePlatformAdmin(path = "/admin"): Promise<PlatformAdminAccess> {
  const session = await loadAppSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(path)}`);
  const client = await createClient();
  // Revalidate current Auth identity and the private grant on every entry.
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user || user.id !== session.user.id) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (!user.email_confirmed_at) redirect("/verificar-email");
  const { data: allowed, error: denied } = await client.rpc("is_platform_admin");
  if (!denied && allowed === true && isOfficialMasterAdminEmail(user.email)) return { session, provisionPending: false };
  // Stale administrative flags must not cause a redirect loop back to /admin.
  redirect(getDefaultDestination({ ...session.context, isPlatformAdmin: false, isOfficialPlatformOwner: false }));
}
export async function requireReadyPlatformAdmin(path: string): Promise<AppSession> {
  return (await requirePlatformAdmin(path)).session;
}
