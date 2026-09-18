import { BOOKING_STEPS } from "@/lib/marketing/content";

export function MarketingBooking() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-8 px-4 py-14 sm:py-20 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center">
        <div className="min-w-0 space-y-4">
          <p className="text-[0.7rem] font-medium tracking-[0.2em] text-primary uppercase">
            Agendamento pelo cliente
          </p>
          <h2 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
            Um link. A cliente escolhe. Você atende.
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Cada negócio no Agendê tem um endereço público. A cliente abre o
            link, vê o que você oferece e marca o horário que ainda está livre.
            Simples para ela. Simples para você.
          </p>
          <div className="rounded-3xl bg-secondary/70 px-4 py-3 text-sm text-secondary-foreground ring-1 ring-border/80">
            Sem instalações. Sem app extra. O link cabe na bio, no WhatsApp e no
            cartão.
          </div>
        </div>

        <ol className="min-w-0 space-y-3">
          {BOOKING_STEPS.map((step, index) => (
            <li
              key={step.title}
              className="flex min-w-0 gap-3 rounded-[1.5rem] bg-card/90 p-4 shadow-[0_14px_32px_-28px_oklch(0.4_0.04_25/0.35)] ring-1 ring-border sm:gap-4 sm:p-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-serif text-lg text-primary">
                {index + 1}
              </span>
              <div className="min-w-0">
                <h3 className="font-serif text-xl leading-tight">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {step.text}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
