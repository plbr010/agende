import { CalendarHeart, Sparkles } from "lucide-react";
import { MARKETING_CTAS } from "@/lib/marketing/content";
import { FloralBranch, FloralCorner } from "@/components/brand/floral";
import { MarketingLinkButton } from "@/components/marketing/link-button";

export function AudienceSplit({
  eyebrow = "Dois caminhos",
  title = "O Agendê é para você.",
}: {
  eyebrow?: string;
  title?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden px-4 py-12 sm:py-16">
      <FloralCorner className="pointer-events-none absolute -left-12 -top-8 z-0 h-24 w-32 opacity-70 sm:-left-8 sm:-top-4 sm:h-28 sm:w-36 xl:left-0 xl:top-4 xl:h-32 xl:w-40 xl:opacity-80" />
      <div className="relative z-10 mx-auto grid w-full max-w-5xl gap-6">
        <div className="max-w-2xl space-y-2">
          <p className="text-[0.7rem] font-medium tracking-[0.2em] text-[var(--rose-ink)] uppercase">{eyebrow}</p>
          <h1 className="relative font-serif text-4xl leading-tight text-wine-deep sm:text-5xl">{title}</h1>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Seja para cuidar do seu negócio ou reservar um momento para você, comece por aqui.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="relative isolate overflow-hidden rounded-[1.8rem] bg-white p-6 shadow-[0_24px_48px_-32px_rgb(92_26_46/0.5)] ring-1 ring-[#f0e4de] sm:p-8">
            <FloralBranch className="pointer-events-none absolute -right-8 -bottom-10 -z-10 h-40 w-32 opacity-70" />
            <span className="grid size-12 place-items-center rounded-full bg-metric-blush text-wine-deep">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-serif text-3xl text-wine-deep">Sou profissional</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Mais organização, menos trabalho. Cuide do seu negócio enquanto o Agendê cuida da sua agenda.
            </p>
            <MarketingLinkButton href="/profissionais" className="mt-6 h-12 rounded-full px-6">
              Conhecer o Agendê
            </MarketingLinkButton>
          </article>
          <article className="relative overflow-hidden rounded-[1.8rem] bg-metric-blush/80 p-6 ring-1 ring-[#f0e4de] sm:p-8">
            <span className="grid size-12 place-items-center rounded-full bg-white text-[var(--rose-ink)]">
              <CalendarHeart className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-5 font-serif text-3xl text-wine-deep">Sou cliente</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Seu próximo momento de beleza está a poucos cliques. Encontre, escolha e agende.
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
