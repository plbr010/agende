import type { Metadata } from "next";
import { AudienceSplit } from "@/components/marketing/audience-split";
import { MarketingShell } from "@/components/marketing/shell";

export const metadata: Metadata = {
  title: "Começar",
  description: "Escolha se você é profissional ou cliente para seguir o caminho certo no Agendê.",
};

export default function ComecarPage() {
  return (
    <MarketingShell>
      <main id="conteudo" className="min-w-0 flex-1">
        <AudienceSplit />
      </main>
    </MarketingShell>
  );
}
