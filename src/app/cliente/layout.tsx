import { ClientShell } from "@/components/client/client-shell";
import { requireConfirmedSession } from "@/lib/auth/session";

export default async function ClienteLayout({ children }: { children: React.ReactNode }) {
  const session = await requireConfirmedSession("/cliente");

  return (
    <ClientShell userName={session.profile.fullName} hasWorkspace={session.context.hasWorkspace}>
      {children}
    </ClientShell>
  );
}
