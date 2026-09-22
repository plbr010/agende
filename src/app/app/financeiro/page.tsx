import { CircleDollarSign } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { FinanceDashboard } from "@/components/finance/finance-dashboard";

export default async function FinancePage() {
  await requireConfirmedSession("/app/financeiro");

  return (
    <>
      <PageHeader
        eyebrow="Saúde do negócio"
        title="Financeiro"
        description="Comece pela receita real da agenda e evolua para um fluxo completo de entradas, saídas e conciliação."
        icon={CircleDollarSign}
      />
      <FinanceDashboard snapshot={null} />
    </>
  );
}
