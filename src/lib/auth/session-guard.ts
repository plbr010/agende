import type { AppSession } from "./session";
import { canAccessPath, getFallbackForDeniedPath } from "./redirects";
import { canAccessWorkspacePath } from "./permissions";

/** Runs in the server session boundary, before a page can call its loaders. */
export function createConfirmedSessionGuard(
  loadSession: () => Promise<AppSession | null>,
  redirect: (path: string) => never,
) {
  return async function requireConfirmedSession(path: string): Promise<AppSession> {
    const session = await loadSession();
    if (!session) {
      redirect(`/login?next=${encodeURIComponent(path)}`);
    }
    if (!session.context.emailConfirmed) {
      redirect("/verificar-email");
    }
    if (!canAccessPath(path, session.context)) {
      redirect(getFallbackForDeniedPath(path, session.context));
    }
    // Use the same active workspace as the page loaders, never another membership.
    if (!canAccessWorkspacePath(path, session.workspaces[0]?.role)) {
      redirect("/app");
    }
    return session;
  };
}
