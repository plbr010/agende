import type { Metadata } from "next";
import { AudienceSplit } from "@/components/marketing/audience-split";
import { MarketingBenefits } from "@/components/marketing/benefits";
import { MarketingFeatures } from "@/components/marketing/features";
import { MarketingHero } from "@/components/marketing/hero";
import { MarketingHowItWorks } from "@/components/marketing/how-it-works";
import { MarketingHashOnLoad } from "@/components/marketing/hash-on-load";
import { MarketingShell } from "@/components/marketing/shell";

export const metadata: Metadata = {
  title: "Agendê — beleza organizada, resultados reais",
  description:
    "Para profissionais da beleza e para quem quer marcar horário. 7 dias grátis para o salão, sem cartão.",
};

export default function HomePage() {
  return (
    <MarketingShell>
      <MarketingHashOnLoad />
      <main id="conteudo" className="min-w-0 flex-1">
        <MarketingHero />
        <MarketingBenefits />
        <AudienceSplit />
        <MarketingFeatures />
        <MarketingHowItWorks />
      </main>
    </MarketingShell>
  );
}
