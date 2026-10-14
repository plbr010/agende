import { CalendarHeart, Sparkles } from "lucide-react";
import { MARKETING_CTAS } from "@/lib/marketing/content";
import { FloralBranch, FloralCorner } from "@/components/brand/floral";
import { MarketingLinkButton } from "@/components/marketing/link-button";

export function AudienceSplit({
  eyebrow = "Como você quer usar o Agendê?",
  title = "Escolha o seu caminho",
}: {
  eyebrow?: string;
  title?: string;
}) {
  return (
    <section className="relative overflow-hidden px-4 py-12 sm:py-16">
      <FloralCorner className="pointer-events-none absolute left-0 top-4 h-32 w-40 opacity-80" />
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <div className="max-w-2xl space-y-2">
          <p className="text-[0.7rem] font-medium tracking-[0.2em] text-[var(--rose-ink)] uppercase">{eyebrow}</p>
          <h1 className="font-serif text-4xl leading-tight text-wine-deep sm:text-5xl">{title}</h1>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Profissionais organizam o salão. Clientes marcam horário. Os preços da assinatura do Agendê aparecem só para quem tem um negócio.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="relative overflow-hidden rounded-[1.8rem] bg-white p-6 shadow-[0_24px_48px_-32px_rgb(92_26_46/0.5)] ring-1 ring-[#f0e4de] sm:p-8">
            <FloralBranch className="pointer-events-none absolute -right-8 -bottom-10 h-40 w-32 opacity-70" />
            <span className="grid size-12 place-items-center rounded-full bg-metric-blush text-wine-deep">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-serif text-3xl text-wine-deep">Sou profissional</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Agenda, equipe, clientes, financeiro e o link para as pessoas marcarem sozinhas. 7 dias grátis, sem cartão.
            </p>
            <MarketingLinkButton href="/profissionais" className="mt-6 h-12 rounded-full px-6">
              Ver benefícios e planos
            </MarketingLinkButton>
          </article>
          <article className="relative overflow-hidden rounded-[1.8rem] bg-metric-blush/80 p-6 ring-1 ring-[#f0e4de] sm:p-8">
            <span className="grid size-12 place-items-center rounded-full bg-white text-[var(--rose-ink)]">
              <CalendarHeart className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-serif text-3xl text-wine-deep">Sou cliente</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Encontre um salão, escolha o serviço e marque o horário. Você vê o preço do atendimento — nunca o plano que o salão paga ao Agendê.
            </p>
            <MarketingLinkButton href={MARKETING_CTAS.clientDiscover.href} variant="rose" className="mt-6 h-12 rounded-full px-6">
              Encontrar um salão
            </MarketingLinkButton>
          </article>
        </div>
      </div>
    </section>
  );
}
