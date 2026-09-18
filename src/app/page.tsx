import type { Metadata } from "next";
import { MarketingBooking } from "@/components/marketing/booking";
import { MarketingFeatures } from "@/components/marketing/features";
import { MarketingFinalCta } from "@/components/marketing/final-cta";
import { MarketingHero } from "@/components/marketing/hero";
import { MarketingHowItWorks } from "@/components/marketing/how-it-works";
import { MarketingPricing } from "@/components/marketing/pricing";
import { MarketingProblems } from "@/components/marketing/problems";
import { MarketingShell } from "@/components/marketing/shell";

export const metadata: Metadata = {
  title: "Agendê — seus clientes agendam sozinhos",
  description:
    "O Agendê organiza o seu negócio de beleza enquanto os clientes marcam horário sozinhos. 7 dias grátis, sem cartão.",
};

export default function HomePage() {
  return (
    <MarketingShell>
      <main id="conteudo" className="min-w-0 flex-1">
        <MarketingHero />
        <MarketingProblems />
        <MarketingFeatures />
        <MarketingBooking />
        <MarketingHowItWorks />
        <MarketingPricing />
        <MarketingFinalCta />
      </main>
    </MarketingShell>
  );
}
