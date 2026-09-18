import type { Metadata } from "next";
import { MarketingLegalLayout } from "@/components/marketing/legal-layout";
import { MarketingShell } from "@/components/marketing/shell";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos de Uso do Agendê, o sistema de agenda para profissionais da beleza.",
};

export default function TermosPage() {
  return (
    <MarketingShell>
      <MarketingLegalLayout title="Termos de Uso">
        <p>
          Esta é a versão inicial dos Termos de Uso do Agendê. O serviço destina-se a
          profissionais da beleza e a clientes finais.
        </p>
        <p>
          Ao criar uma conta, você confirma que as informações fornecidas são suas e
          que o e-mail informado poderá ser usado para autenticação e comunicação
          essencial do produto.
        </p>
        <p>
          Dados de um negócio não devem ser acessados por outro. Assinaturas e trials
          pertencem ao workspace, não à pessoa física isoladamente.
        </p>
      </MarketingLegalLayout>
    </MarketingShell>
  );
}
