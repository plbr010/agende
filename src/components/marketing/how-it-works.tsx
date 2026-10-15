import { FloralSprig } from "@/components/brand/floral";
import { HOW_IT_WORKS } from "@/lib/marketing/content";

const STEP_TONE = ["bg-metric-blush", "bg-white", "bg-metric-sand", "bg-metric-ivory", "bg-metric-lilac"] as const;

export function MarketingHowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-32 overflow-x-clip">
      <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-14 sm:py-20">
        <div className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-2xl space-y-3">
            <p className="text-[0.7rem] font-medium tracking-[0.2em] text-primary uppercase">
              Como funciona
            </p>
            <h2 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
              Cinco passos. Sem complicação.
            </h2>
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              O Agendê foi pensado para caber na rotina de quem atende o dia
              inteiro — e para a cliente marcar em poucos toques.
            </p>
          </div>
          <FloralSprig className="pointer-events-none ml-auto h-28 w-20 sm:h-40 sm:w-28" />
        </div>

        <ol className="mt-10 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {HOW_IT_WORKS.map((item, index) => (
            <li
              key={item.step}
              className={`relative min-w-0 rounded-[1.6rem] p-5 ring-1 ring-[#f0e4de] ${STEP_TONE[index] ?? "bg-white"}`}
            >
              <span className="font-serif text-4xl text-primary/70">{item.step}</span>
              <h3 className="mt-3 font-serif text-xl leading-tight">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
