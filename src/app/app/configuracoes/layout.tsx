import { Settings2 } from "lucide-react";
import { SettingsNav } from "@/components/workspace/settings-nav";
import { PageHeader } from "@/components/app/page-header";
import { requireConfirmedSession } from "@/lib/auth/session";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireConfirmedSession("/app/configuracoes");
  const role = session.workspaces[0]?.role;
  const showBilling = role === "owner" || role === "admin";
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Estabelecimento"
        title="Configurações"
        description="Dados do salão, a página que as clientes veem e, para quem administra, o plano."
        icon={Settings2}
      />
      <SettingsNav showBilling={showBilling} />
      {children}
    </div>
  );
}
