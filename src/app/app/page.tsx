import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Sparkles,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { enableClientProfileAction } from "@/lib/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/app/metric-card";
import { OnboardingProgressSteps } from "@/components/onboarding/progress-steps";
import { loadClients, loadServices, loadTeam } from "@/lib/catalog/queries";
import { loadAgendaRange, loadWorkingHours } from "@/lib/agenda/queries";
import { STATUS_LABEL } from "@/lib/agenda/status";

import { formatDateTime } from "@/lib/workspace/timezone";
import { PLAN_LABEL, SUBSCRIPTION_STATUS_LABEL } from "@/lib/workspace/labels";
import { loadWorkspaceSettings } from "@/lib/workspace/queries";
import { addDaysIso, formatTimeInTimeZone, todayInTimeZone } from "@/lib/time/timezone";
import { formatCentsToReais } from "@/lib/validation/money";

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ clientError?: string; setup?: string }>;
}) {
  const { clientError, setup } = await searchParams;
  const session = await requireConfirmedSession("/app");
  const workspace = session.workspaces[0];
  const settings = workspace ? await loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug) : null;
  const timezone = settings?.timezone ?? "America/Sao_Paulo";
  const today = todayInTimeZone(timezone);
  const [team, services, clients, appointments] = workspace
    ? await Promise.all([
        loadTeam(workspace.id),
        loadServices(workspace.id),
        loadClients(workspace.id),
        loadAgendaRange(workspace.id, today, addDaysIso(today, 1)),
      ])
    : [[], [], [], []];
  const guideMember =
    team.find((member) => member.hasProfessionalProfile && member.bookingEnabled !== false) ?? team[0];
  const workingHours =
    workspace && guideMember ? await loadWorkingHours(workspace.id, guideMember.memberId) : [];
  const activeAppointments = appointments.filter(
    (appointment) => appointment.status !== "cancelled" && appointment.status !== "no_show",
  );
  const completedAppointments = appointments.filter((appointment) => appointment.status === "completed");
  const expectedRevenue = activeAppointments.reduce((sum, appointment) => sum + appointment.priceCents, 0);
  const nextAppointments = appointments
    .filter((appointment) =>
      appointment.status === "scheduled" ||
      appointment.status === "confirmed" ||
      appointment.status === "in_progress",
    )
    .slice(0, 5);
  const firstName = session.profile.fullName.split(/\s+/)[0] || "profissional";
  const activeServices = services.filter((service) => service.active);
  const servicesWithPros = activeServices.filter((service) => service.professionalMemberIds.length > 0);
  const setupSteps = [
    {
      done: servicesWithPros.length > 0,
      title: "Cadastre um serviço com profissional",
      href: "/app/servicos",
      hint: "Sem vínculo, o serviço não aparece na página pública.",
    },
    {
      done: workingHours.length > 0,
      title: "Configure a jornada da equipe",
      href: guideMember ? `/app/equipe/${guideMember.memberId}/disponibilidade` : "/app/equipe",
      hint: "Horários de trabalho liberam as vagas para agendar.",
    },
    {
      done: servicesWithPros.length > 0 && workingHours.length > 0,
      title: "Compartilhe a página pública",
      href: workspace ? `/p/${workspace.slug}` : "/app/configuracoes/geral",
      hint: workspace ? `/p/${workspace.slug}` : "Publique o link do seu negócio.",
    },
  ] as const;
  const setupIncomplete = setupSteps.some((step) => !step.done);

  return (
    <>
      {clientError ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          Não foi possível ativar sua área de cliente agora. Tente novamente em instantes.
        </p>
      ) : null}
      {setupIncomplete ? (
        <section className="rounded-[2rem] border border-primary/20 bg-secondary/40 px-5 py-5 sm:px-6" aria-label="Primeiros passos">
          <OnboardingProgressSteps current={3} className="mb-5" />
          {setup === "1" ? (
            <p className="mb-3 rounded-2xl bg-card px-4 py-3 text-sm ring-1 ring-border" role="status">
              Negócio criado e trial de 7 dias ativo. Complete os passos abaixo para abrir a agenda pública.
            </p>
          ) : null}
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Para abrir a agenda</p>
          <h2 className="mt-2 font-serif text-2xl">Próximo passo: configure o essencial</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Comece pelo item ainda pendente. Sem serviço e jornada, clientes não conseguem marcar horário.
          </p>
          <ol className="mt-4 grid gap-3">
            {setupSteps.map((step, index) => (
              <li key={step.title}>
                <Link
                  href={step.href}
                  className={`flex items-start gap-3 rounded-2xl px-4 py-3 ring-1 transition-colors hover:bg-secondary/60 ${
                    step.done ? "bg-card/70 ring-border" : "bg-card ring-primary/40"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      step.done ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
                    }`}
                    aria-label={step.done ? "Concluído" : `Passo ${index + 1}`}
                  >
                    {step.done ? "ok" : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium">{step.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{step.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-primary px-5 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 size-52 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-primary-foreground/75 uppercase">
              <Sparkles className="size-3.5" /> Área profissional
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl leading-none font-semibold tracking-tight sm:text-5xl">
              {setupIncomplete
                ? `Vamos deixar a agenda pronta, ${firstName}.`
                : `Um dia bonito começa organizado, ${firstName}.`}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-primary-foreground/75 sm:text-base">
              {setupIncomplete
                ? "Depois dos primeiros passos, seus clientes passam a marcar sozinhos pelo link público."
                : "Acompanhe a agenda, cuide dos seus clientes e mantenha o ritmo do negócio sem perder a leveza."}
            </p>
          </div>
          {!setupIncomplete ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="lg" className="h-11 rounded-full px-5" render={<Link href="/app/agenda?novo=1" />}>
                <CalendarDays className="size-4" /> Novo agendamento
              </Button>
              <Button variant="outline" size="lg" className="h-11 rounded-full border-white/30 bg-white/10 px-5 text-white hover:bg-white/20 hover:text-white" render={<Link href="/app/clientes?novo=1" />}>
                <UserRoundPlus className="size-4" /> Novo cliente
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="lg"
              className="h-11 rounded-full px-5"
              render={<Link href={setupSteps.find((step) => !step.done)?.href ?? "/app/servicos"} />}
            >
              Continuar configuração
            </Button>
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo do dia">
        <MetricCard label="Agenda de hoje" value={activeAppointments.length} hint="atendimentos válidos" icon={CalendarCheck2} />
        <MetricCard label="Concluídos" value={completedAppointments.length} hint="finalizados hoje" icon={Clock3} tone="success" />
        <MetricCard label="Previsão do dia" value={formatCentsToReais(expectedRevenue)} hint="sem cancelamentos e faltas" icon={CircleDollarSign} tone="warning" />
        <MetricCard label="Base de clientes" value={clients.length} hint={`${services.filter((service) => service.active).length} serviços ativos`} icon={UsersRound} tone="neutral" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.6fr)]">
        <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="text-xl">Próximos atendimentos</CardTitle>
            <CardDescription>O que ainda está no seu radar hoje.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1 pt-2">
            {nextAppointments.length === 0 ? (
              <div className="grid place-items-center gap-3 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
                  <CalendarDays className="size-5" />
                </div>
                <div>
                  <p className="font-medium">Agenda livre por enquanto</p>
                  <p className="mt-1 text-sm text-muted-foreground">Aproveite para organizar a semana ou criar um horário.</p>
                </div>
                <Button variant="outline" className="rounded-full" render={<Link href={setupIncomplete ? "/app/servicos" : "/app/agenda?novo=1"} />}>
                  {setupIncomplete ? "Cadastrar serviço" : "Novo agendamento"}
                </Button>
              </div>
            ) : (
              nextAppointments.map((appointment) => (
                <Link
                  key={appointment.id}
                  href={`/app/agenda?date=${appointment.localDate}`}
                  className="group grid grid-cols-[4.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-secondary/60"
                >
                  <div className="rounded-xl bg-secondary px-2 py-2 text-center">
                    <p className="font-serif text-xl leading-none">{formatTimeInTimeZone(appointment.startsAt, timezone)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{appointment.clientName}</p>
                    <p className="truncate text-xs text-muted-foreground">{appointment.serviceName} · {appointment.professionalName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="hidden sm:inline-flex">{STATUS_LABEL[appointment.status]}</Badge>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Seu negócio</CardTitle>
              <CardDescription>Estrutura pronta para atender.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {[
                ["Equipe", team.length, "/app/equipe"],
                ["Serviços", services.length, "/app/servicos"],
                ["Clientes", clients.length, "/app/clientes"],
              ].map(([label, count, href]) => (
                <Link key={String(label)} href={String(href)} className="flex items-center justify-between rounded-2xl bg-secondary/55 px-4 py-3 transition-colors hover:bg-secondary">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="font-serif text-2xl">{count}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-3xl border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle>Assinatura do workspace</CardTitle>
            <CardDescription>
              Pertence ao negócio, não à sua conta pessoal. Datas vêm do banco.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge>{PLAN_LABEL[session.subscription?.plan ?? "solo"]}</Badge>
              <Badge variant="secondary">
                {SUBSCRIPTION_STATUS_LABEL[session.subscription?.status ?? "expired"]}
              </Badge>
            </div>
            <p className="text-sm">
              Trial iniciado: {formatDateTime(session.subscription?.trialStartedAt ?? null, timezone)}
            </p>
            <p className="text-sm">
              Trial termina: {formatDateTime(session.subscription?.trialEndsAt ?? null, timezone)}
            </p>
            <p className="text-sm text-muted-foreground">
              Papel: {workspace?.role ?? "—"}. Página pública: /p/{workspace?.slug}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle>Agenda</CardTitle>
            <CardDescription>
              Jornada, pausas e agendamentos internos do estabelecimento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="h-11" render={<Link href="/app/agenda" />}>
              Abrir agenda
            </Button>
            {!session.context.hasClientProfile ? (
              <form action={enableClientProfileAction}>
                <Button variant="outline" type="submit" className="h-11">
                  Também quero agendar como cliente
                </Button>
              </form>
            ) : (
              <Button variant="outline" className="h-11 w-fit rounded-full" render={<Link href="/cliente" />}>
                Ir para minha área de cliente
              </Button>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
