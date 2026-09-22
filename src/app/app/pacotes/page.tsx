import { PackageCheck } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { PackagesDashboard } from "@/components/packages/packages-dashboard";

export default async function PackagesPage() {
  await requireConfirmedSession("/app/pacotes");

  return (
    <>
      <PageHeader
        eyebrow="Fidelização"
        title="Pacotes"
        description="Crie combinações de serviços que valorizam seu trabalho e ajudam clientes a manter uma rotina de cuidado."
        icon={PackageCheck}
      />
      <PackagesDashboard snapshot={null} />
    </>
  );
}
