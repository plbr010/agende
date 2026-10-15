import { CalendarDays, ChartNoAxesCombined, CircleDollarSign, UsersRound } from "lucide-react";
import { HOME_BENEFITS } from "@/lib/marketing/content";
import { FloralBranch, FloralSprig } from "@/components/brand/floral";

const ICONS = {
  agenda: CalendarDays,
  clientes: UsersRound,
  financeiro: CircleDollarSign,
  relatorios: ChartNoAxesCombined,
} as const;

export function MarketingBenefits() {
  return (
    <section className="relative overflow-x-clip">
      <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-14 sm:py-20">
        <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="mx-auto max-w-2xl space-y-3 text-center sm:mx-0 sm:text-left">
            <h2 className="font-serif text-3xl leading-tight text-wine-deep sm:text-5xl">
              Tudo que você precisa, em um só lugar
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              Do agendamento à gestão financeira, o Agendê simplifica o seu dia e te ajuda a focar no que realmente importa: seus clientes.
            </p>
          </div>
          <FloralBranch className="pointer-events-none ml-auto h-28 w-24 sm:h-48 sm:w-36" />
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOME_BENEFITS.map((item) => {
            const Icon = ICONS[item.id];
            return (
              <article
                key={item.id}
                className="relative flex min-h-[13rem] flex-col items-center overflow-hidden rounded-[1.7rem] bg-white/90 px-5 py-7 text-center shadow-[0_18px_40px_-30px_rgb(92_26_46/0.45)] ring-1 ring-[#f0e4de]"
              >
                <FloralSprig className="pointer-events-none absolute -right-4 -bottom-8 h-24 w-16 opacity-80" />
                <span className="relative grid size-14 place-items-center rounded-full bg-metric-blush text-[var(--rose-ink)]">
                  <Icon className="size-6" strokeWidth={1.6} aria-hidden="true" />
                </span>
                <h3 className="relative mt-5 font-serif text-xl text-wine-deep">{item.title}</h3>
                <p className="relative mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
