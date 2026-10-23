import Link from "next/link";
import { CalendarDays, LayoutDashboard } from "lucide-react";
import { FloralSprig } from "@/components/brand/floral";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { TRIAL_COPY } from "@/lib/billing/plans";
import { DEMO_BOOK_HREF, DEMO_CLIENT_HREF, DEMO_PANEL_HREF, DEMO_PLANS_HREF, DEMO_TRIAL_HREF } from "@/lib/demo/paths";

export default function DemoPage() {
  return (
    <main className="agende-bloom relative mx-auto grid w-full max-w-3xl gap-8 overflow-x-clip px-4 py-8 sm:py-12">
      <FloralSprig className="pointer-events-none absolute top-6 right-0 h-20 w-14 opacity-80" />
      <header className="grid gap-4">
        <BrandLogo size="sm" href="/" />
        <p className="text-xs font-semibold tracking-[0.18em] text-[var(--rose-ink)] uppercase">Demonstração</p>
        <h1 className="font-serif text-4xl leading-[1.05] text-wine-deep sm:text-5xl">Conheça o Agendê na prática</h1>
        <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
          Veja como seus clientes agendam horários e como você organiza seu negócio em um só lugar.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="agende-panel flex flex-col gap-4 rounded-[1.75rem] p-5 ring-1 ring-[#f0e4de] sm:p-6">
          <CalendarDays className="size-6 text-wine-deep" aria-hidden="true" />
          <h2 className="font-serif text-3xl text-wine-deep">Experimentar como cliente</h2>
          <p className="text-sm leading-6 text-muted-foreground">Abra o Studio Bella — Demonstração, escolha um serviço e confirme um horário fictício. Sem conta, sem telefone e sem cartão.</p>
          <Button className="mt-auto h-12 w-full rounded-full" render={<Link href={DEMO_CLIENT_HREF} />}>Ver o salão</Button>
          <Button variant="outline" className="h-12 w-full rounded-full" render={<Link href={DEMO_BOOK_HREF} />}>Agendar um horário</Button>
        </article>
        <article className="agende-panel flex flex-col gap-4 rounded-[1.75rem] p-5 ring-1 ring-[#f0e4de] sm:p-6">
          <LayoutDashboard className="size-6 text-wine-deep" aria-hidden="true" />
          <h2 className="font-serif text-3xl text-wine-deep">Conhecer o painel profissional</h2>
          <p className="text-sm leading-6 text-muted-foreground">Veja a agenda, os clientes, os serviços e o financeiro de um salão fictício. O horário que você marcar aparece para a equipe.</p>
          <Button className="mt-auto h-12 w-full rounded-full" render={<Link href={DEMO_PANEL_HREF} />}>Abrir o painel</Button>
          <Button variant="outline" className="h-12 w-full rounded-full" render={<Link href="/demo/painel/agenda" />}>Ir para a agenda</Button>
        </article>
      </div>
      <section className="agende-panel rounded-[1.75rem] p-5 ring-1 ring-[#f0e4de] sm:p-6">
        <h2 className="font-serif text-2xl text-wine-deep">Caminho guiado</h2>
        <ol className="mt-3 grid gap-2 text-sm leading-6">
          <li>1. Escolha um serviço na página do salão.</li>
          <li>2. Agende um horário de demonstração.</li>
          <li>3. Veja esse horário na agenda profissional.</li>
          <li>4. Percorra a gestão do estúdio.</li>
          <li>5. Comece o teste gratuito quando quiser.</li>
        </ol>
        <Button className="mt-4 h-12 rounded-full" render={<Link href={DEMO_BOOK_HREF} />}>Começar pelo agendamento</Button>
      </section>
      <section className="grid gap-3 pb-8">
        <p className="text-sm leading-6 text-muted-foreground">{TRIAL_COPY}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="h-12 rounded-full" render={<Link href={DEMO_TRIAL_HREF} />}>Começar meu teste gratuito</Button>
          <Button variant="outline" className="h-12 rounded-full" render={<Link href={DEMO_PLANS_HREF} />}>Conhecer os planos</Button>
        </div>
      </section>
    </main>
  );
}
