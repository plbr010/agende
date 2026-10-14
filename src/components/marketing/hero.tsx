import Image from "next/image";
import { CalendarDays, Sparkles, UsersRound } from "lucide-react";
import { MARKETING_CTAS } from "@/lib/marketing/content";
import { FloralBranch, FloralCorner, FloralSprig } from "@/components/brand/floral";
import { MarketingLinkButton } from "@/components/marketing/link-button";

const MICRO = [
  { icon: CalendarDays, title: "Agenda online 24h", text: "Clientes marcam sozinhas." },
  { icon: Sparkles, title: "Gestão completa", text: "Do seu negócio no mesmo lugar." },
  { icon: UsersRound, title: "Mais clientes", text: "E mais receita no dia a dia." },
] as const;

export function MarketingHero() {
  return (
    <section className="relative overflow-hidden">
      <FloralSprig className="pointer-events-none absolute top-4 -left-6 h-52 w-32 opacity-80 sm:top-8 sm:left-0 sm:h-64 sm:w-36" />
      <FloralBranch className="pointer-events-none absolute -right-10 bottom-8 hidden h-72 w-52 rotate-12 opacity-80 lg:block" />

      <div className="lg:hidden">
        <MobileSplash />
      </div>

      <div className="mx-auto hidden w-full min-w-0 max-w-6xl items-center gap-10 px-4 pt-12 pb-8 lg:grid lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-8 lg:pt-16 lg:pb-12">
        <div className="min-w-0 max-w-xl space-y-6">
          <h1 className="font-serif text-[3.35rem] leading-[1.05] text-wine-deep">
            Beleza organizada,{" "}
            <span className="text-rose-ink">resultados reais.</span>
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
            O Agendê é o sistema completo para salões, clínicas e profissionais da beleza que
            querem mais tempo, mais clientes e mais crescimento.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <MarketingLinkButton href={MARKETING_CTAS.primary.href} className="h-12 min-h-12 rounded-full px-7 text-base">
              {MARKETING_CTAS.primary.label}
            </MarketingLinkButton>
            <MarketingLinkButton
              href={MARKETING_CTAS.secondary.href}
              variant="outline"
              className="h-12 min-h-12 rounded-full bg-white/80 px-7 text-base"
            >
              {MARKETING_CTAS.secondary.label}
            </MarketingLinkButton>
          </div>
          <p className="text-sm text-muted-foreground">
            Profissionais começam com 7 dias grátis, sem cartão. Clientes agendam sem pagar o Agendê.
          </p>
        </div>
        <HeroCollage />
      </div>

      <ul className="mx-auto hidden w-full max-w-6xl grid-cols-3 gap-4 px-4 pb-12 lg:grid">
        {MICRO.map((item) => (
          <li key={item.title} className="flex items-start gap-3 rounded-[1.4rem] bg-white/70 px-4 py-4 ring-1 ring-[#f0e4de]">
            <span className="grid size-10 place-items-center rounded-full bg-metric-blush text-wine-deep">
              <item.icon className="size-4" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-medium text-wine-deep">{item.title}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{item.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MobileSplash() {
  return (
    <div className="relative mx-4 mt-4 overflow-hidden rounded-[2rem] bg-gradient-to-b from-[#f8e4df] to-[#fbf4ee] px-5 pb-8 pt-6 ring-1 ring-[#f0e4de] sm:mx-auto sm:max-w-md">
      <FloralCorner className="pointer-events-none absolute -left-6 -top-4 h-36 w-44 opacity-90" />
      <FloralBranch className="pointer-events-none absolute -right-8 bottom-16 h-48 w-36 rotate-[20deg] opacity-80" />
      <div className="relative">
        <h1 className="mt-4 text-center font-serif text-[2.15rem] leading-[1.12] text-wine-deep">
          Sua beleza também merece uma boa agenda.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-muted-foreground">
          Organize seus atendimentos, conquiste mais clientes e viva o melhor da sua profissão — ou encontre um salão perto de você.
        </p>
        <Image
          src="/brand/brushes.jpg"
          alt=""
          width={320}
          height={427}
          className="mx-auto mt-6 h-40 w-auto rounded-[1.4rem] object-cover shadow-[0_24px_40px_-24px_rgb(92_26_46/0.45)]"
        />
        <div className="mt-6 grid gap-3">
          <MarketingLinkButton href={MARKETING_CTAS.primary.href} className="h-12 w-full rounded-full">
            Sou profissional
          </MarketingLinkButton>
          <MarketingLinkButton href={MARKETING_CTAS.secondary.href} variant="rose" className="h-12 w-full rounded-full">
            Sou cliente
          </MarketingLinkButton>
        </div>
        <p className="mt-4 text-center text-sm">
          <a href={MARKETING_CTAS.login.href} className="text-[var(--rose-ink)] underline-offset-4 hover:underline">
            Já tenho uma conta
          </a>
        </p>
      </div>
    </div>
  );
}

function HeroCollage() {
  return (
    <div className="relative mx-auto min-h-[32rem] w-full max-w-[34rem]">
      <div className="absolute top-4 right-2 size-[22rem] overflow-hidden rounded-full bg-[#edc6b8] shadow-[0_40px_80px_-36px_rgb(92_26_46/0.55)] ring-8 ring-[#f7ddd4]">
        {/* positioned ancestor for next/image fill */}
        <Image src="/brand/hero-beauty.jpg" alt="" fill sizes="22rem" className="object-cover object-[50%_20%]" />
      </div>
      <FloralBranch className="absolute -left-6 bottom-8 h-56 w-40 -rotate-12" />
      <p className="absolute top-10 right-4 max-w-[9rem] text-right font-serif text-xl italic leading-tight text-[var(--rose-ink)]">
        Mais tempo para o que importa
      </p>
      <div className="absolute bottom-6 left-2 w-[16.5rem] rounded-[1.6rem] bg-white/95 p-4 shadow-[0_28px_50px_-28px_rgb(92_26_46/0.5)] ring-1 ring-[#f0e4de]">
        <p className="text-[0.65rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Agendamentos de hoje
        </p>
        <ul className="mt-3 grid gap-2.5">
          <AgendaRow time="09:00" name="Manicure" person="Ana Silva" />
          <AgendaRow time="10:30" name="Cutelagem" person="Beatriz Lima" />
          <AgendaRow time="14:00" name="Escova" person="Carla Mendes" />
        </ul>
      </div>
    </div>
  );
}

function AgendaRow({ time, name, person }: { time: string; person: string; name: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="w-12 shrink-0 font-serif text-sm text-wine-deep">{time}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">{person}</span>
      </span>
    </li>
  );
}
