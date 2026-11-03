import "server-only";
import { redirect } from "next/navigation";
import { loadAppSession, type AppSession } from "@/lib/auth/session";
import { getDefaultDestination } from "@/lib/auth/redirects";

export type PlatformAdminAccess = {
  session: AppSession;
  provisionPending: boolean;
};

export async function requirePlatformAdmin(
  path = "/admin",
  options: { allowProvision?: boolean } = {},
): Promise<PlatformAdminAccess> {
  const session = await loadAppSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  if (!session.context.emailConfirmed) {
    redirect("/verificar-email");
  }
  if (session.context.isPlatformAdmin) {
    return { session, provisionPending: false };
  }
  if (session.hold.held) {
    redirect("/conta-suspensa");
  }
  if (options.allowProvision && session.context.isOfficialPlatformOwner) {
    return { session, provisionPending: true };
  }
  redirect(getDefaultDestination(session.context));
}

export async function requireReadyPlatformAdmin(path: string): Promise<AppSession> {
  const access = await requirePlatformAdmin(path, { allowProvision: true });
  if (access.provisionPending) {
    redirect("/admin");
  }
  return access.session;
}
