import { PROBLEMS, SOLUTIONS } from "@/lib/marketing/content";

export function MarketingProblems() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-14 sm:py-20">
        <div className="max-w-2xl space-y-3">
          <p className="text-[0.7rem] font-medium tracking-[0.2em] text-primary uppercase">
            O problema
          </p>
          <h2 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
            O estúdio cresce. A organização, quase nunca.
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            A maior parte do tempo some no WhatsApp, na agenda espalhada e no
            controle feito à mão. O Agendê existe para devolver esse tempo ao
            atendimento.
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map((problem, index) => (
            <article
              key={problem.title}
              className="min-w-0 rounded-[1.6rem] bg-card/85 p-5 shadow-[0_18px_40px_-30px_oklch(0.42_0.04_25/0.4)] ring-1 ring-border"
            >
              <p className="text-xs tracking-[0.16em] text-primary/80 uppercase">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 font-serif text-xl text-foreground">{problem.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {problem.text}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-[1.8rem] bg-primary px-5 py-7 text-primary-foreground shadow-[0_24px_50px_-28px_oklch(0.45_0.08_18/0.55)] sm:px-8 sm:py-9">
          <p className="text-[0.7rem] font-medium tracking-[0.2em] uppercase opacity-80">
            A solução
          </p>
          <h3 className="mt-2 max-w-2xl font-serif text-3xl leading-tight sm:text-4xl">
            O Agendê junta o negócio em um só lugar — e deixa a cliente marcar sozinha.
          </h3>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {SOLUTIONS.map((item) => (
              <li key={item} className="flex min-w-0 items-start gap-2 text-sm sm:text-base">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
