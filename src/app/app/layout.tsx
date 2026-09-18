import { requireConfirmedSession } from "@/lib/auth/session";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireConfirmedSession("/app");
  const workspace = session.workspaces[0];

  return <AppShell workspaceName={workspace?.name ?? "Seu negócio"}>{children}</AppShell>;
}
