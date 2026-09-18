import {
  CalendarDays,
  History,
  Link2,
  Package,
  Sparkles,
  UserRoundCog,
  Users,
  Wallet,
} from "lucide-react";
import { FEATURES } from "@/lib/marketing/content";

const ICONS = {
  agenda: CalendarDays,
  online: Link2,
  clientes: Users,
  servicos: Sparkles,
  equipe: UserRoundCog,
  financeiro: Wallet,
  estoque: Package,
  historico: History,
} as const;

export function MarketingFeatures() {
  return (
    <section id="funcionalidades" className="scroll-mt-32">
      <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-14 sm:py-20">
        <div className="max-w-2xl space-y-3">
          <p className="text-[0.7rem] font-medium tracking-[0.2em] text-primary uppercase">
            Funcionalidades
          </p>
          <h2 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
            Tudo o que o estúdio precisa, com a cara da beleza.
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Agenda, clientes, serviços e o link de agendamento — e, na visão do
            produto, financeiro, estoque e histórico no mesmo Agendê. Sem
            dashboard genérico. Sem ferramenta feita para outro mercado.
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => {
            const Icon = ICONS[feature.id];
            return (
              <article
                key={feature.id}
                className="flex min-w-0 flex-col rounded-[1.6rem] bg-card/90 p-5 shadow-[0_16px_36px_-28px_oklch(0.4_0.04_25/0.35)] ring-1 ring-border"
              >
                <span className="flex size-10 items-center justify-center rounded-2xl bg-secondary text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-serif text-xl">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.text}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
