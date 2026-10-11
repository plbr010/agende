import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  Star,
  UsersRound,
} from "lucide-react";
import { OnboardingProgressSteps } from "@/components/onboarding/progress-steps";
import { CopyLinkButton } from "@/components/usability/copy-link-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { enableClientProfileAction } from "@/lib/auth/actions";
import type { CalendarDay } from "@/lib/dashboard/summary";
import { STATUS_LABEL, type AppointmentStatus } from "@/lib/agenda/status";
import { cn } from "@/lib/utils";

export type DashboardVisit = {
  id: string;
  clientName: string;
  serviceName: string;
  professionalName: string;
  localDate: string;
  localStart: string;
  status: AppointmentStatus;
};

export type DashboardMetric = {
  label: string;
  value: string;
  hint: string;
  href: string;
  tone: "blush" | "sand" | "ivory" | "lilac";
  delta: number | null;
  stars?: { filled: number; label: string } | null;
};

const TONE_CLASS = {
  blush: "bg-metric-blush",
  sand: "bg-metric-sand",
  ivory: "bg-metric-ivory",
  lilac: "bg-metric-lilac",
} as const;

const METRIC_ICON = {
  blush: CalendarDays,
  sand: CircleDollarSign,
  ivory: UsersRound,
  lilac: Star,
} as const;

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  scheduled: "bg-[var(--status-scheduled-bg)] text-[var(--status-scheduled-fg)]",
  confirmed: "bg-[var(--status-confirmed-bg)] text-[var(--status-confirmed-fg)]",
  in_progress: "bg-[var(--status-progress-bg)] text-[var(--status-progress-fg)]",
  completed: "bg-[var(--status-done-bg)] text-[var(--status-done-fg)]",
  cancelled: "bg-[var(--status-muted-bg)] text-[var(--status-muted-fg)]",
  no_show: "bg-[var(--status-muted-bg)] text-[var(--status-muted-fg)]",
};

const AVATAR_CLASS = [
  "bg-[#f3c8c7] text-[#631d38]",
  "bg-[#f6d7c8] text-[#7a3048]",
  "bg-[#f0e0ea] text-[#5c1a2e]",
];

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function initials(value: string): string {
  const parts = value.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

function avatarClass(name: string): string {
  const code = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_CLASS[code % AVATAR_CLASS.length];
}

function LeafMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M5 19c6-1 10-5 12-12-7 1-12 6-12 12Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M8 16c2-2 4-4 7-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function DeltaLine({ delta }: { delta: number }) {
  if (delta === 0) {
    return <p className="mt-2 text-xs leading-5 text-muted-foreground">Igual a ontem</p>;
  }
  const positive = delta > 0;
  return (
    <p className={cn("mt-2 text-xs leading-5 font-medium whitespace-nowrap", positive ? "text-[#14663c]" : "text-[#8e3a55]")}>
      {positive ? "↑" : "↓"} {Math.abs(delta)}% vs. ontem
    </p>
  );
}

function VisitRow({
  visit,
  showProfessional,
}: {
  visit: DashboardVisit;
  showProfessional: boolean;
}) {
  return (
    <Link
      href={`/app/agenda?date=${visit.localDate}`}
      className="grid min-h-16 grid-cols-[3.4rem_minmax(0,1fr)] items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-[#fff6f4] sm:grid-cols-[3.6rem_minmax(0,1fr)_auto]"
    >
      <p className="font-serif text-xl leading-none tracking-tight text-wine-deep">{visit.localStart}</p>
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold",
            avatarClass(visit.clientName),
          )}
          aria-hidden="true"
        >
          {initials(visit.clientName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-foreground">{visit.clientName}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {visit.serviceName}
            {showProfessional ? ` · ${visit.professionalName}` : ""}
          </span>
        </span>
      </span>
      <span className={cn("col-span-2 w-fit rounded-full px-2.5 py-1 text-xs font-medium sm:col-span-1 sm:justify-self-end", STATUS_CLASS[visit.status])}>
        {STATUS_LABEL[visit.status]}
      </span>
    </Link>
  );
}

export function ProfessionalDashboard({
  firstName,
  salonName,
  todayLabel,
  clientError,
  metrics,
  todayVisits,
  showProfessional,
  cancelledToday,
  upcoming,
  calendar,
  setup,
  plan,
  primaryAction,
}: {
  firstName: string;
  salonName: string;
  todayLabel: string;
  clientError: boolean;
  metrics: DashboardMetric[];
  todayVisits: DashboardVisit[];
  showProfessional: boolean;
  cancelledToday: number;
  upcoming: DashboardVisit[];
  calendar: {
    title: string;
    prevHref: string;
    nextHref: string;
    weeks: CalendarDay[][];
  };
  setup: {
    showWelcome: boolean;
    steps: Array<{ done: boolean; title: string; href: string; hint: string }>;
    nextHref: string;
    publicPath: string | null;
  } | null;
  plan: {
    planLabel: string;
    statusLabel: string;
    trialStarted: string;
    trialEnds: string;
    roleLabel: string;
    publicPath: string | null;
    hasClientProfile: boolean;
  };
  primaryAction: { href: string; label: string };
}) {
  return (
    <div className="grid gap-5">
      {clientError ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          Não foi possível ativar sua área de cliente agora. Tente novamente em instantes.
        </p>
      ) : null}

      {setup ? (
        <section className="rounded-[1.5rem] bg-white px-5 py-5 shadow-[0_18px_40px_-32px_rgba(92,26,46,0.45)] ring-1 ring-[#f3c8c7] sm:px-6" aria-label="Primeiros passos">
          <OnboardingProgressSteps current={3} className="mb-5" />
          {setup.showWelcome ? (
            <p className="mb-3 rounded-2xl bg-metric-blush px-4 py-3 text-sm" role="status">
              Salão criado. Faltam estes passos para as clientes marcarem sozinhas.
            </p>
          ) : null}
          <p className="text-xs font-semibold tracking-[0.16em] text-wine-deep uppercase">Para clientes marcarem sozinhas</p>
          <h2 className="mt-2 font-serif text-3xl text-wine-deep">Faça estes 3 passos</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Comece pelo item ainda pendente. Sem serviço e horários, ninguém consegue marcar.
          </p>
          <ol className="mt-4 grid gap-3">
            {setup.steps.map((step, index) => (
              <li key={step.title}>
                <Link
                  href={step.href}
                  className={cn(
                    "flex min-h-14 items-start gap-3 rounded-2xl px-4 py-3 ring-1 transition-colors hover:bg-metric-blush",
                    step.done ? "bg-[#fffaf8] ring-[#eadfd8]" : "bg-white ring-[#e7b7c4]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 shrink-0 items-center justify-center rounded-full px-2 text-xs font-semibold",
                      step.done ? "bg-primary text-primary-foreground" : "min-w-7 bg-metric-blush text-wine-deep",
                    )}
                    aria-label={step.done ? "Concluído" : `Passo ${index + 1}`}
                  >
                    {step.done ? "Feito" : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{step.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{step.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          {setup.publicPath ? (
            <div className="mt-4">
              <CopyLinkButton path={setup.publicPath} label="Copiar link do salão" className="h-11 w-full sm:w-auto" />
            </div>
          ) : null}
        </section>
      ) : null}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-serif text-[1.85rem] leading-none tracking-tight text-wine-deep sm:text-5xl">
            Olá, {firstName}!
            <LeafMark className="ml-2 inline size-5 -translate-y-1 text-[var(--rose)] sm:size-7" />
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            {todayLabel} · {salonName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="h-11 rounded-full px-5" render={<Link href={primaryAction.href} />}>
            {primaryAction.label}
          </Button>
          {setup ? null : (
            <Button variant="secondary" className="h-11 rounded-full px-5" render={<Link href="/app/clientes?novo=1" />}>
              Novo cliente
            </Button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Resumo do dia">
        {metrics.map((metric) => {
          const Icon = METRIC_ICON[metric.tone];
          return (
            <Link
              key={metric.label}
              href={metric.href}
              className={cn(
                "flex min-h-32 min-w-0 flex-col rounded-[1.25rem] p-3.5 shadow-[0_18px_40px_-30px_rgba(92,26,46,0.5)] ring-1 ring-white/80 transition-transform hover:-translate-y-0.5 sm:p-4",
                TONE_CLASS[metric.tone],
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-[0.78rem] leading-4 font-medium text-muted-foreground sm:text-sm">{metric.label}</span>
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/80 text-wine-deep">
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
              </span>
              <span className="mt-3 font-serif text-[1.35rem] leading-none tracking-tight break-words text-wine-deep sm:text-4xl">
                {metric.value}
              </span>
              {metric.stars ? (
                <span className="mt-2 flex items-center gap-0.5" aria-label={metric.stars.label}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <Star
                      key={index}
                      className={cn("size-3.5", index < metric.stars!.filled ? "fill-[#c47b62] text-[#c47b62]" : "text-[#e4cfc6]")}
                      aria-hidden="true"
                    />
                  ))}
                </span>
              ) : null}
              {metric.delta !== null ? <DeltaLine delta={metric.delta} /> : null}
              <span className="mt-1 text-xs leading-5 text-muted-foreground">{metric.hint}</span>
            </Link>
          );
        })}
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18.5rem,0.78fr)]">
        <article className="rounded-[1.5rem] bg-white p-4 shadow-[0_18px_40px_-32px_rgba(92,26,46,0.45)] ring-1 ring-[#f0e4de] sm:p-5">
          <div className="flex items-end justify-between gap-3 px-2">
            <div>
              <h2 className="font-serif text-2xl text-wine-deep sm:text-3xl">Agenda de hoje</h2>
              <p className="mt-1 text-sm text-muted-foreground">{todayLabel}</p>
            </div>
            <Link href="/app/agenda" className="inline-flex h-11 items-center text-sm font-medium text-wine-deep underline-offset-4 hover:underline">
              Ver agenda
            </Link>
          </div>
          <div className="mt-3 grid gap-1">
            {todayVisits.length === 0 ? (
              <div className="grid place-items-center gap-3 px-4 py-12 text-center">
                <div className="grid size-12 place-items-center rounded-full bg-metric-blush text-wine-deep">
                  <CalendarDays className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium">Agenda livre por enquanto</p>
                  <p className="mt-1 text-sm text-muted-foreground">Quando houver horário hoje, ele aparece aqui com a hora e o nome.</p>
                </div>
                <Button variant="outline" className="h-11 rounded-full" render={<Link href={setup ? setup.nextHref : "/app/agenda?novo=1"} />}>
                  {setup ? "Cadastrar serviço" : "Novo horário"}
                </Button>
              </div>
            ) : (
              todayVisits.map((visit) => (
                <VisitRow key={visit.id} visit={visit} showProfessional={showProfessional} />
              ))
            )}
          </div>
          {cancelledToday > 0 ? (
            <p className="px-2 pt-2 text-sm text-muted-foreground">
              {cancelledToday === 1 ? "1 horário cancelado hoje." : `${cancelledToday} horários cancelados hoje.`}
            </p>
          ) : null}
        </article>

        <div className="grid gap-4">
          <article className="rounded-[1.5rem] bg-white p-4 shadow-[0_18px_40px_-32px_rgba(92,26,46,0.45)] ring-1 ring-[#f0e4de] sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif text-2xl text-wine-deep">{calendar.title}</h2>
              <div className="flex gap-1">
                <Link href={calendar.prevHref} aria-label="Mês anterior" className="grid size-11 place-items-center rounded-full text-wine-deep hover:bg-metric-blush">
                  ‹
                </Link>
                <Link href={calendar.nextHref} aria-label="Próximo mês" className="grid size-11 place-items-center rounded-full text-wine-deep hover:bg-metric-blush">
                  ›
                </Link>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[0.7rem] font-medium tracking-wide text-muted-foreground" aria-hidden="true">
              {WEEKDAYS.map((label, index) => (
                <span key={`${label}-${index}`} className="grid h-8 place-items-center">{label}</span>
              ))}
            </div>
            <div className="grid gap-1" role="grid" aria-label={`Calendário de ${calendar.title}`}>
              {calendar.weeks.map((week) => (
                <div key={week[0].iso} className="grid grid-cols-7 gap-1" role="row">
                  {week.map((day) => (
                    <Link
                      key={day.iso}
                      href={`/app/agenda?date=${day.iso}`}
                      role="gridcell"
                      aria-current={day.isToday ? "date" : undefined}
                      aria-label={`${day.day}${day.isToday ? ", hoje" : ""}${day.hasAppointment ? ", com horário" : ""}`}
                      className="relative grid h-11 w-full place-items-center rounded-full text-sm hover:bg-metric-blush/70"
                    >
                      <span
                        className={cn(
                          "relative grid size-9 place-items-center rounded-full",
                          day.isToday && "bg-wine-deep font-semibold text-white",
                          !day.isToday && day.inMonth && "text-foreground",
                          !day.inMonth && "text-muted-foreground/45",
                        )}
                      >
                        {day.day}
                        {day.hasAppointment ? (
                          <span
                            className={cn("absolute bottom-1 size-1 rounded-full", day.isToday ? "bg-white" : "bg-[var(--rose)]")}
                            aria-hidden="true"
                          />
                        ) : null}
                      </span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.5rem] bg-white p-4 shadow-[0_18px_40px_-32px_rgba(92,26,46,0.45)] ring-1 ring-[#f0e4de] sm:p-5">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-serif text-2xl text-wine-deep">Próximos agendamentos</h2>
              <Link href="/app/agenda" className="inline-flex h-11 items-center text-sm font-medium text-[var(--rose-ink)]">
                Ver tudo
              </Link>
            </div>
            <div className="mt-2 grid">
              {upcoming.length === 0 ? (
                <p className="px-1 py-6 text-sm leading-6 text-muted-foreground">Nenhum horário nos próximos dias.</p>
              ) : (
                upcoming.map((visit) => (
                  <Link
                    key={visit.id}
                    href={`/app/agenda?date=${visit.localDate}`}
                    className="grid min-h-16 grid-cols-[3.4rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-1 py-2 hover:bg-[#fff6f4]"
                  >
                    <span className="font-serif text-lg leading-none text-wine-deep">{visit.localStart}</span>
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full text-[0.7rem] font-semibold", avatarClass(visit.clientName))} aria-hidden="true">
                        {initials(visit.clientName)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{visit.clientName}</span>
                        <span className="block truncate text-xs text-muted-foreground">{visit.serviceName}</span>
                      </span>
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                ))
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="rounded-[1.5rem] bg-white p-5 shadow-[0_18px_40px_-32px_rgba(92,26,46,0.4)] ring-1 ring-[#f0e4de]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.16em] text-wine-deep uppercase">Plano do salão</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="font-serif text-3xl text-wine-deep">{plan.planLabel}</p>
              <Badge variant="secondary">{plan.statusLabel}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Teste grátis: {plan.trialStarted} até {plan.trialEnds}. Sua função: {plan.roleLabel}.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {plan.publicPath ? <CopyLinkButton path={plan.publicPath} label="Copiar link do salão" className="h-11" /> : null}
            <Button variant="outline" className="h-11 rounded-full" render={<Link href="/app/agenda" />}>
              Abrir agenda
            </Button>
            {!plan.hasClientProfile ? (
              <form action={enableClientProfileAction}>
                <Button variant="outline" type="submit" className="h-11 rounded-full">
                  Quero marcar horários em outros salões também
                </Button>
              </form>
            ) : (
              <Button variant="outline" className="h-11 rounded-full" render={<Link href="/cliente" />}>
                Ir para minha área de cliente
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
