import type { Database } from "@/lib/supabase/database.types";

export type WorkspaceRole = Database["public"]["Enums"]["member_role"];

const managers = ["owner", "admin"] as const satisfies readonly WorkspaceRole[];
const commissionReaders = ["owner", "admin", "professional"] as const satisfies readonly WorkspaceRole[];

export type WorkspacePermissions = Readonly<Record<string, boolean>>;

/** Frontend route permissions mirror the existing Supabase manager guards. */
export const workspaceRoutePermissions: Readonly<Record<string, readonly WorkspaceRole[]>> = {
  "/app/estoque": managers,
  "/app/pacotes": managers,
  "/app/financeiro": managers,
  "/app/relatorios": managers,
  "/app/comissoes": commissionReaders,
};

function grantedRoute(path: string, permissions: WorkspacePermissions): boolean | null {
  if (path === "/app/estoque" || path.startsWith("/app/estoque/")) {
    return Boolean(permissions["inventory.view"]);
  }
  if (path === "/app/financeiro" || path.startsWith("/app/financeiro/")) {
    return Boolean(permissions["finance.view"] || permissions["finance.manage"]);
  }
  if (path === "/app/relatorios" || path.startsWith("/app/relatorios/")) {
    return Boolean(permissions["reports.view"] || permissions["finance.manage"]);
  }
  if (path === "/app/comissoes" || path.startsWith("/app/comissoes/")) {
    return Boolean(permissions["commissions.view_own"] || permissions["commissions.manage_team"] || permissions["commissions.pay"]);
  }
  return null;
}

export function canAccessWorkspacePath(
  path: string,
  role: WorkspaceRole | null | undefined,
  permissions?: WorkspacePermissions | null,
): boolean {
  const pathname = path.split(/[?#]/, 1)[0];
  if (permissions) {
    const granted = grantedRoute(pathname, permissions);
    if (granted != null) {
      return granted;
    }
  }
  const permission = Object.entries(workspaceRoutePermissions)
    .find(([route]) => pathname === route || pathname.startsWith(`${route}/`));
  return !permission || (role != null && permission[1].includes(role));
}
