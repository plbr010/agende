import type { Database } from "@/lib/supabase/database.types";

export type WorkspaceRole = Database["public"]["Enums"]["member_role"];

const managers = ["owner", "admin"] as const satisfies readonly WorkspaceRole[];

/** Frontend route permissions mirror the existing Supabase manager guards. */
export const workspaceRoutePermissions: Readonly<Record<string, readonly WorkspaceRole[]>> = {
  "/app/estoque": managers,
  "/app/pacotes": managers,
  "/app/financeiro": managers,
  "/app/relatorios": managers,
};

export function canAccessWorkspacePath(path: string, role: WorkspaceRole | null | undefined): boolean {
  const pathname = path.split(/[?#]/, 1)[0];
  const permission = Object.entries(workspaceRoutePermissions)
    .find(([route]) => pathname === route || pathname.startsWith(`${route}/`));
  return !permission || (role != null && permission[1].includes(role));
}

