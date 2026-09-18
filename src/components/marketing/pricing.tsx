import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MARKETING_CTAS, PLANS } from "@/lib/marketing/content";
import { cn } from "@/lib/utils";

export function MarketingPricing() {
  return (
    <section id="planos" className="scroll-mt-24">
      <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-14 sm:py-20">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <p className="text-[0.7rem] font-medium tracking-[0.2em] text-primary uppercase">
            Planos
          </p>
          <h2 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
            Escolha o tamanho do seu estúdio.
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Todos os planos incluem 7 dias grátis. Sem cartão para começar.
          </p>
        </div>

        <div className="mt-10 grid items-stretch gap-4 lg:grid-cols-3 lg:gap-5">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={cn(
                "relative flex min-w-0 flex-col rounded-[1.8rem] p-6 ring-1 sm:p-7",
                plan.popular
                  ? "bg-primary text-primary-foreground shadow-[0_28px_60px_-32px_oklch(0.42_0.08_18/0.6)] ring-primary lg:-translate-y-2"
                  : "bg-card/90 text-foreground shadow-[0_18px_40px_-30px_oklch(0.4_0.04_25/0.35)] ring-border",
              )}
            >
              {plan.popular ? (
                <p className="absolute top-4 right-4 rounded-full bg-accent px-3 py-1 text-[0.65rem] font-medium tracking-[0.12em] text-accent-foreground uppercase">
                  Mais popular
                </p>
              ) : null}
              <h3 className="font-serif text-3xl">{plan.name}</h3>
              <p
                className={cn(
                  "mt-1 text-sm",
                  plan.popular ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {plan.seats}
              </p>
              <p className="mt-6 flex flex-wrap items-end gap-1">
                <span className="font-serif text-4xl leading-none tracking-tight sm:text-5xl">
                  {plan.price}
                </span>
                <span
                  className={cn(
                    "pb-1 text-sm",
                    plan.popular ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {plan.period}
                </span>
              </p>
              <ul
                className={cn(
                  "mt-6 space-y-2 text-sm",
                  plan.popular ? "text-primary-foreground/90" : "text-muted-foreground",
                )}
              >
                <li>7 dias grátis</li>
                <li>Sem cartão para começar</li>
                <li>Agenda e link de agendamento</li>
              </ul>
              <Button
                variant={plan.popular ? "secondary" : "default"}
                className="mt-8 h-12 min-h-12 w-full rounded-full text-base"
                render={<Link href={MARKETING_CTAS.primary.href} />}
              >
                {MARKETING_CTAS.primary.label}
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
