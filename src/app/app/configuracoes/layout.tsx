import { Settings2 } from "lucide-react";
import { SettingsNav } from "@/components/workspace/settings-nav";
import { PageHeader } from "@/components/app/page-header";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Estabelecimento"
        title="Configurações"
        description="O jeito como o salão se apresenta, o time e o plano. Sem painel genérico — só o que o negócio precisa agora."
        icon={Settings2}
      />
      <SettingsNav />
      {children}
    </div>
  );
}
