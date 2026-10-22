"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Sparkles, Star } from "lucide-react";
import { FloralSprig } from "@/components/brand/floral";
import { CopyLinkButton } from "@/components/usability/copy-link-button";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/components/demo/demo-provider";
import { STATUS_LABEL } from "@/lib/agenda/status";
import { STATUS_CHIP_CLASS } from "@/lib/agenda/status-style";
import { DEMO_CLIENT_HREF, DEMO_PLANS_HREF, DEMO_TRIAL_HREF, demoAgendaHref } from "@/lib/demo/paths";
import { demoClients, demoReviews } from "@/lib/demo/project";
import {
  averageRating,
  buildMonthGrid,
  dayCount,
  dayRevenueCents,
  formatDashboardDate,
  formatRatingPt,
  monthTitle,
  parseMonthParam,
  percentChange,
  shiftMonth,
  upcomingAppointments,
} from "@/lib/dashboard/summary";
import { addDaysIso } from "@/lib/time/timezone";
import { TRIAL_COPY } from "@/lib/billing/plans";
import { formatCentsToReais } from "@/lib/validation/money";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function DemoHome() {
  const demo = useDemo();
  const params = useSearchParams();
  const month = parseMonthParam(params.get("mes") ?? undefined, demo.today);
  const yesterday = addDaysIso(demo.today, -1);
  const visits = demo.appointments.map((item) => ({
    id: item.id,
    clientName: item.clientName,
    serviceName: item.serviceName,
    professionalName: item.professionalName,
    localDate: item.localDate,
    localStart: item.localStart,
    status: item.status,
  }));
  const todayVisits = visits.filter((item) => item.localDate === demo.today && item.status !== "cancelled");
  const occupied = new Set(demo.appointments.filter((item) => item.status !== "cancelled" && item.status !== "no_show").map((item) => item.localDate));
  const rating = averageRating(demoReviews(demo.appointments).map((review) => review.rating));
  const metrics = [
    { label: "Agendamentos hoje", value: String(dayCount(demo.appointments, demo.today)), hint: "Sem cancelados", href: demoAgendaHref(demo.today), delta: percentChange(dayCount(demo.appointments, demo.today), dayCount(demo.appointments, yesterday)) },
    { label: "Receita do dia", value: formatCentsToReais(dayRevenueCents(demo.appointments, demo.today)), hint: "Soma dos horários, sem faltas", href: "/demo/painel/financeiro", delta: percentChange(dayRevenueCents(demo.appointments, demo.today), dayRevenueCents(demo.appointments, yesterday)) },
    { label: "Clientes ativos", value: String(demoClients(demo.session, demo.appointments).length), hint: "Cadastrados no salão fictício", href: "/demo/painel/clientes", delta: null },
    { label: "Avaliação média", value: rating === null ? "—" : formatRatingPt(rating), hint: `${demoReviews(demo.appointments).length} avaliações fictícias`, href: "/demo/painel/avaliacoes", delta: null },
  ];
  const weeks = buildMonthGrid(month, demo.today, occupied);
  const upcoming = upcomingAppointments(visits, demo.today);
  const visitor = demo.appointments.find((item) => item.id === demo.session.highlightId);

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-[1.85rem] leading-none tracking-tight text-wine-deep sm:text-5xl">
            Olá, Marina!
            <Sparkles className="ml-2 inline size-5 -translate-y-1 text-[var(--rose)] sm:size-7" aria-hidden="true" />
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">Studio Bella — Demonstração · salão fictício</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/80 px-3 text-sm text-muted-foreground ring-1 ring-[#f0e4de]">
            <CalendarDays className="size-4" aria-hidden="true" />
            {formatDashboardDate(demo.today, "America/Sao_Paulo")}
          </p>
          <Button className="h-11 rounded-full px-5" render={<Link href={visitor ? demoAgendaHref(visitor.localDate, visitor.id) : "/demo/cliente/agendar"} />}>
            {visitor ? "Ver horário da demonstração" : "Experimentar como cliente"}
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Resumo do dia">
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href} className="flex min-h-32 min-w-0 flex-col rounded-[1.25rem] bg-metric-blush p-3.5 ring-1 ring-white/80 sm:p-4">
            <span className="text-[0.78rem] leading-4 font-medium text-muted-foreground sm:text-sm">{metric.label}</span>
            <span className="mt-3 font-serif text-[1.35rem] leading-none tracking-tight text-wine-deep sm:text-4xl">{metric.value}</span>
            {metric.delta !== null ? <span className="mt-2 text-xs text-muted-foreground">{metric.delta === 0 ? "Igual a ontem" : `${metric.delta > 0 ? "↑" : "↓"} ${Math.abs(metric.delta)}% vs. ontem`}</span> : null}
            <span className="mt-1 text-xs leading-5 text-muted-foreground">{metric.hint}</span>
          </Link>
        ))}
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18.5rem,0.78fr)]">
        <article className="agende-panel rounded-[1.5rem] p-4 ring-1 ring-[#f0e4de] sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-serif text-2xl text-wine-deep sm:text-3xl">Agenda de hoje</h2>
            <Link href={demoAgendaHref(demo.today)} className="inline-flex h-11 items-center text-sm font-medium text-wine-deep underline-offset-4 hover:underline">Ver agenda</Link>
          </div>
          <div className="mt-3 grid gap-2">
            {todayVisits.length === 0 ? <p className="px-1 py-6 text-sm leading-6 text-muted-foreground">Nenhum horário aberto hoje.</p> : todayVisits.map((visit) => (
              <Link key={visit.id} href={demoAgendaHref(visit.localDate, visit.id)} className="grid min-h-16 grid-cols-[3.4rem_minmax(0,1fr)] items-center gap-3 rounded-2xl px-2 py-2 hover:bg-[#fff6f4]">
                <p className="font-serif text-xl leading-none text-wine-deep">{visit.localStart}</p>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{visit.clientName}</span>
                  <span className="block truncate text-sm text-muted-foreground">{visit.serviceName} · {visit.professionalName}</span>
                  <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-xs", STATUS_CHIP_CLASS[visit.status])}>{STATUS_LABEL[visit.status]}</span>
                </span>
              </Link>
            ))}
          </div>
        </article>
        <article className="agende-panel rounded-[1.5rem] p-4 ring-1 ring-[#f0e4de] sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-serif text-2xl text-wine-deep">{monthTitle(month)}</h2>
            <div className="flex gap-1">
              <Link href={`/demo/painel?mes=${shiftMonth(month, -1)}`} aria-label="Mês anterior" className="grid size-11 place-items-center rounded-full text-wine-deep hover:bg-metric-blush">‹</Link>
              <Link href={`/demo/painel?mes=${shiftMonth(month, 1)}`} aria-label="Próximo mês" className="grid size-11 place-items-center rounded-full text-wine-deep hover:bg-metric-blush">›</Link>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[0.7rem] text-muted-foreground" aria-hidden="true">
            {WEEKDAYS.map((label, index) => <span key={`${label}-${index}`} className="grid h-8 place-items-center">{label}</span>)}
          </div>
          <div className="grid gap-1" role="grid" aria-label={`Calendário de ${monthTitle(month)}`}>
            {weeks.map((week) => (
              <div key={week[0].iso} className="grid grid-cols-7 gap-1" role="row">
                {week.map((day) => (
                  <Link key={day.iso} href={demoAgendaHref(day.iso)} role="gridcell" aria-current={day.isToday ? "date" : undefined} aria-label={`${day.day}${day.isToday ? ", hoje" : ""}${day.hasAppointment ? ", com horário" : ""}`} className="grid h-11 place-items-center rounded-full text-sm hover:bg-metric-blush/70">
                    <span className={cn("relative grid size-8 place-items-center rounded-full", day.isToday && "bg-wine-deep font-semibold text-white", !day.inMonth && "text-muted-foreground/45")}>
                      {day.day}
                      {day.hasAppointment ? <span className={cn("absolute mt-5 size-1 rounded-full", day.isToday ? "bg-white" : "bg-[var(--rose)]")} /> : null}
                    </span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </article>
      </section>

      <article className="agende-panel rounded-[1.5rem] p-4 ring-1 ring-[#f0e4de] sm:p-5">
        <h2 className="font-serif text-2xl text-wine-deep">Próximos agendamentos</h2>
        <div className="mt-2 grid">
          {upcoming.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Nenhum horário nos próximos dias.</p> : upcoming.map((visit) => (
            <Link key={visit.id} href={demoAgendaHref(visit.localDate, visit.id)} className="flex min-h-14 items-center justify-between gap-3 border-b border-[#f0e4de] py-2 text-sm last:border-0">
              <span className="min-w-0">
                <span className="block font-medium">{visit.clientName}</span>
                <span className="text-muted-foreground">{visit.localDate.split("-").reverse().join("/")} · {visit.localStart} · {visit.serviceName}</span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", STATUS_CHIP_CLASS[visit.status])}>{STATUS_LABEL[visit.status]}</span>
            </Link>
          ))}
        </div>
      </article>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <article className="agende-panel rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de]">
          <FloralSprig className="mb-2 h-12 w-8" />
          <h2 className="font-serif text-2xl text-wine-deep">Página que a cliente vê</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">No Agendê, este é o link enviado no WhatsApp. Aqui ele abre o estúdio fictício.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" className="h-11 rounded-full" render={<Link href={DEMO_CLIENT_HREF} />}>Abrir página</Button>
            <CopyLinkButton path={DEMO_CLIENT_HREF} label="Copiar link da demonstração" className="h-11" />
          </div>
        </article>
        <article className="agende-panel rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de]">
          <h2 className="font-serif text-2xl text-wine-deep">Teste gratuito</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{TRIAL_COPY}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="h-11 rounded-full" render={<Link href={DEMO_TRIAL_HREF} />}>Começar meu teste gratuito</Button>
            <Button variant="outline" className="h-11 rounded-full" render={<Link href={DEMO_PLANS_HREF} />}>Conhecer os planos</Button>
          </div>
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><Star className="size-3.5" aria-hidden="true" /> A demonstração não cria assinatura nem pede cartão.</p>
        </article>
      </section>
    </div>
  );
}
