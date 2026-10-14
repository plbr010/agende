import { CalendarDays, ChartNoAxesCombined, CircleDollarSign, UsersRound } from "lucide-react";
import { HOME_BENEFITS } from "@/lib/marketing/content";
import { FloralBranch } from "@/components/brand/floral";

const ICONS = {
  agenda: CalendarDays,
  clientes: UsersRound,
  financeiro: CircleDollarSign,
  relatorios: ChartNoAxesCombined,
} as const;

export function MarketingBenefits() {
  return (
    <section className="relative overflow-hidden">
      <FloralBranch className="pointer-events-none absolute right-0 top-8 hidden h-64 w-48 opacity-70 lg:block" />
      <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-14 sm:py-20">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <h2 className="font-serif text-3xl leading-tight text-wine-deep sm:text-5xl">
            Tudo que você precisa, em um só lugar
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Do agendamento à gestão financeira, o Agendê simplifica o seu dia e te ajuda a focar no que realmente importa: seus clientes.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOME_BENEFITS.map((item) => {
            const Icon = ICONS[item.id];
            return (
              <article
                key={item.id}
                className="flex min-h-[13rem] flex-col items-center rounded-[1.7rem] bg-white/90 px-5 py-7 text-center shadow-[0_18px_40px_-30px_rgb(92_26_46/0.45)] ring-1 ring-[#f0e4de]"
              >
                <span className="grid size-14 place-items-center rounded-full bg-metric-blush text-[var(--rose-ink)]">
                  <Icon className="size-6" strokeWidth={1.6} aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-serif text-xl text-wine-deep">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
