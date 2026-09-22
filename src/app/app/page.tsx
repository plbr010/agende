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
import { loadClients, loadServices, loadTeam } from "@/lib/catalog/queries";
import { loadAgendaRange } from "@/lib/agenda/queries";
import { STATUS_LABEL } from "@/lib/agenda/status";

import { formatDateTime } from "@/lib/workspace/timezone";
import { PLAN_LABEL, SUBSCRIPTION_STATUS_LABEL } from "@/lib/workspace/labels";
import { loadWorkspaceSettings } from "@/lib/workspace/queries";
import { addDaysIso, formatTimeInProductTz, todayInProductTz } from "@/lib/time/timezone";
import { formatCentsToReais } from "@/lib/validation/money";

export default async function AppPage() {
  const session = await requireConfirmedSession("/app");
  const workspace = session.workspaces[0];
  const today = todayInProductTz();
  const [team, services, clients, settings, appointments] = workspace
    ? await Promise.all([
        loadTeam(workspace.id),
        loadServices(workspace.id),
        loadClients(workspace.id),
        loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug),
        loadAgendaRange(workspace.id, today, addDaysIso(today, 1)),
      ])
    : [[], [], [], null, []];
  const timezone = settings?.timezone;
  const activeAppointments = appointments.filter(
    (appointment) => appointment.status !== "cancelled" && appointment.status !== "no_show",
  );
  const completedAppointments = appointments.filter((appointment) => appointment.status === "completed");
  const expectedRevenue = activeAppointments.reduce((sum, appointment) => sum + appointment.priceCents, 0);
  const nextAppointments = appointments
    .filter((appointment) => appointment.status !== "cancelled" && appointment.status !== "no_show")
    .slice(0, 5);
  const firstName = session.profile.fullName.split(/\s+/)[0] || "profissional";

  return (
    <>
      <section className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-primary px-5 py-7 text-primary-foreground shadow-xl shadow-primary/15 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 size-52 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-primary-foreground/75 uppercase">
              <Sparkles className="size-3.5" /> Área profissional
            </p>
            <h1 className="mt-3 max-w-2xl text-4xl leading-none font-semibold tracking-tight sm:text-5xl">
              Um dia bonito começa organizado, {firstName}.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-primary-foreground/75 sm:text-base">
              Acompanhe a agenda, cuide dos seus clientes e mantenha o ritmo do negócio sem perder a leveza.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="lg" className="h-11 rounded-full px-5" render={<Link href="/app/agenda" />}>
              <CalendarDays className="size-4" /> Abrir agenda
            </Button>
            <Button variant="outline" size="lg" className="h-11 rounded-full border-white/30 bg-white/10 px-5 text-white hover:bg-white/20 hover:text-white" render={<Link href="/app/clientes" />}>
              <UserRoundPlus className="size-4" /> Novo cliente
            </Button>
          </div>
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
                <Button variant="outline" className="rounded-full" render={<Link href="/app/agenda" />}>Ir para agenda</Button>
              </div>
            ) : (
              nextAppointments.map((appointment) => (
                <Link
                  key={appointment.id}
                  href={`/app/agenda?date=${appointment.localDate}`}
                  className="group grid grid-cols-[4.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-secondary/60"
                >
                  <div className="rounded-xl bg-secondary px-2 py-2 text-center">
                    <p className="font-serif text-xl leading-none">{formatTimeInProductTz(appointment.startsAt)}</p>
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
