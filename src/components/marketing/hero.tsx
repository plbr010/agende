import { AUDIENCE, MARKETING_CTAS } from "@/lib/marketing/content";
import { FloralSprig } from "@/components/brand/floral";
import { BookingPreview } from "@/components/marketing/booking-preview";
import { MarketingLinkButton } from "@/components/marketing/link-button";

export function MarketingHero() {
  return (
    <section className="relative overflow-hidden">
      <FloralSprig className="pointer-events-none absolute -left-10 top-6 hidden h-64 w-36 opacity-80 sm:block" />
      <FloralSprig className="pointer-events-none absolute -right-8 bottom-0 hidden h-56 w-32 rotate-180 opacity-70 lg:block" />
      <div className="mx-auto grid w-full min-w-0 max-w-6xl items-center gap-10 px-4 pt-10 pb-6 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12 lg:pt-20 lg:pb-10">
        <div className="min-w-0 max-w-xl space-y-6">
          <p className="text-[0.7rem] font-medium tracking-[0.22em] text-[var(--rose-ink)] uppercase sm:text-xs">
            O sistema completo para a sua beleza
          </p>
          <h1 className="font-serif text-[1.85rem] leading-[1.12] text-[var(--wine)] sm:text-4xl sm:leading-[1.08] lg:text-[3.25rem]">
            Organize sua agenda, encante seus clientes.
          </h1>
          <p className="max-w-lg text-[0.95rem] leading-relaxed text-muted-foreground sm:text-lg">
            Chega de agenda no papel e de responder horário no WhatsApp. Você
            configura uma vez, compartilha o link, e acompanha tudo em um só
            lugar.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <MarketingLinkButton
              href={MARKETING_CTAS.primary.href}
              className="h-12 min-h-12 w-full rounded-full px-6 text-base sm:w-auto"
            >
              {MARKETING_CTAS.primary.label}
            </MarketingLinkButton>
            <MarketingLinkButton
              href={MARKETING_CTAS.secondary.href}
              variant="outline"
              className="h-12 min-h-12 w-full rounded-full px-6 text-base sm:w-auto"
            >
              {MARKETING_CTAS.secondary.label}
            </MarketingLinkButton>
          </div>
          <p className="text-sm text-muted-foreground">
            7 dias grátis · sem cartão para começar · feito para o celular
          </p>
          <ul className="flex max-w-xl flex-wrap gap-2 pt-1">
            {AUDIENCE.map((item) => (
              <li
                key={item}
                className="rounded-full bg-secondary/80 px-3 py-1.5 text-xs text-secondary-foreground ring-1 ring-border/70"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
        <BookingPreview />
      </div>
    </section>
  );
}
