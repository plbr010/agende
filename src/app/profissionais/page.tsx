import type { Metadata } from "next";
import { MARKETING_CTAS } from "@/lib/marketing/content";
import { FloralBranch, FloralSprig } from "@/components/brand/floral";
import { MarketingBenefits } from "@/components/marketing/benefits";
import { MarketingFeatures } from "@/components/marketing/features";
import { MarketingHowItWorks } from "@/components/marketing/how-it-works";
import { MarketingLinkButton } from "@/components/marketing/link-button";
import { MarketingPricing } from "@/components/marketing/pricing";
import { MarketingProblems } from "@/components/marketing/problems";
import { MarketingShell } from "@/components/marketing/shell";

export const metadata: Metadata = {
  title: "Para profissionais",
  description:
    "Agenda, clientes, equipe e o link público para as pessoas marcarem sozinhas. Planos Solo, Equipe e Salão com 7 dias grátis.",
};

export default function ProfissionaisPage() {
  return (
    <MarketingShell>
      <main id="conteudo" className="min-w-0 flex-1">
        <section className="relative overflow-x-clip">
          <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 pt-12 pb-10 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:pt-16">
            <div className="grid gap-6">
            <p className="text-[0.7rem] font-medium tracking-[0.2em] text-[var(--rose-ink)] uppercase">Para profissionais</p>
            <h1 className="max-w-3xl font-serif text-4xl leading-tight text-wine-deep sm:text-6xl">
              Organize a agenda e deixe as clientes marcarem sozinhas.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              7 dias grátis, sem cartão. Depois, Solo, Equipe até 5 ou Equipe até 15 — com os valores reais do Agendê.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <MarketingLinkButton href={MARKETING_CTAS.professionalSignup.href} className="h-12 rounded-full px-6">
                Começar 7 dias grátis
              </MarketingLinkButton>
              <MarketingLinkButton href="#planos" variant="outline" className="h-12 rounded-full bg-white/80 px-6">
                Ver planos
              </MarketingLinkButton>
            </div>
            </div>
            <div className="pointer-events-none relative h-28 w-full sm:h-56 sm:w-52">
              <FloralSprig className="absolute top-0 left-0 h-28 w-20 opacity-90 sm:h-44 sm:w-28" />
              <FloralBranch className="absolute right-0 bottom-0 h-28 w-24 opacity-90 sm:h-56 sm:w-44" />
            </div>
          </div>
        </section>
        <MarketingBenefits />
        <MarketingProblems />
        <MarketingFeatures />
        <MarketingHowItWorks />
        <MarketingPricing />
      </main>
    </MarketingShell>
  );
}
