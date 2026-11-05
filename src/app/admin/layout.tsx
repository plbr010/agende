import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { requirePlatformAdmin } from "@/lib/admin/guard";

export const metadata: Metadata = {
  title: "Painel master",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session } = await requirePlatformAdmin("/admin");


  return (
    <AdminShell
      userName={session.profile.fullName}
      userEmail={session.user.email}
      hasAvatar={session.profile.hasAvatar}
      avatarVersion={session.profile.avatarVersion}
      hasWorkspace={session.workspaces.length > 0}
    >
      {children}
    </AdminShell>
  );
}
