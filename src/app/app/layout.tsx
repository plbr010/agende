import { requireConfirmedSession } from "@/lib/auth/session";
import { AppShell } from "@/components/app/app-shell";
import { MEMBER_ROLE_LABEL } from "@/lib/workspace/labels";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireConfirmedSession("/app");
  const workspace = session.workspaces[0];

  return (
    <AppShell
      workspaceName={workspace?.name ?? "Seu salão"}
      workspaceSlug={workspace?.slug ?? ""}
      userName={session.profile.fullName}
      roleLabel={workspace ? MEMBER_ROLE_LABEL[workspace.role] : "Profissional"}
      role={workspace?.role}
    >
      {children}
    </AppShell>
  );
}
