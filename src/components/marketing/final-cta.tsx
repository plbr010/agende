import { MARKETING_CTAS } from "@/lib/marketing/content";
import { MarketingLinkButton } from "@/components/marketing/link-button";

export function MarketingFinalCta() {
  return (
    <section className="px-4 pb-16 sm:pb-24">
      <div className="mx-auto w-full min-w-0 max-w-6xl overflow-hidden rounded-[1.9rem] bg-secondary px-5 py-10 ring-1 ring-border/80 sm:px-10 sm:py-14">
        <div className="mx-auto max-w-2xl space-y-5 text-center">
          <h2 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
            Comece os 7 dias grátis. Sem cartão.
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Monte o negócio, compartilhe o link e deixe as clientes marcarem
            sozinhas. Você volta a atender — o Agendê organiza o resto.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <MarketingLinkButton
              href={MARKETING_CTAS.primary.href}
              className="h-12 min-h-12 w-full rounded-full px-6 text-base sm:w-auto"
            >
              {MARKETING_CTAS.primary.label}
            </MarketingLinkButton>
            <MarketingLinkButton
              href={MARKETING_CTAS.secondary.href}
              variant="outline"
              className="h-12 min-h-12 w-full rounded-full bg-background/70 px-6 text-base sm:w-auto"
            >
              {MARKETING_CTAS.secondary.label}
            </MarketingLinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
