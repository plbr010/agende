import { loadWorkspaceSettings } from "@/lib/workspace/queries";
import { CalendarCheck2, CalendarDays, CircleDollarSign, Clock3 } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { AgendaBoard } from "@/components/agenda/agenda-board";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { loadClients, loadServices, loadTeam } from "@/lib/catalog/queries";
import { loadAgendaRange, loadCurrentMemberId } from "@/lib/agenda/queries";
import { addDaysIso, todayInTimeZone, weekdayInTimeZone, zonedWallTimeToUtc } from "@/lib/time/timezone";
import { formatCentsToReais } from "@/lib/validation/money";

function weekStart(date: string, timezone: string): string {
  const weekday = weekdayInTimeZone(zonedWallTimeToUtc(date, "12:00", timezone), timezone);
  return addDaysIso(date, -weekday);
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string; professional?: string }>;
}) {
  const session = await requireConfirmedSession("/app/agenda");
  const workspace = session.workspaces[0];
  if (!workspace) {
    return null;
  }

  const params = await searchParams;
  const { timezone } = await loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug);
  const today = todayInTimeZone(timezone);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : today;
  const view = params.view === "week" ? "week" : "day";
  const professional = params.professional && /^[0-9a-f-]{36}$/i.test(params.professional) ? params.professional : "";
  const fromDate = view === "week" ? weekStart(date, timezone) : date;
  const weekDates = Array.from({ length: 7 }, (_, index) => addDaysIso(fromDate, index));
  const toDateExclusive = view === "week" ? addDaysIso(fromDate, 7) : addDaysIso(date, 1);

  const [appointments, team, services, clients, currentMemberId] = await Promise.all([
    loadAgendaRange(workspace.id, fromDate, toDateExclusive, professional || undefined),
    loadTeam(workspace.id),
    loadServices(workspace.id),
    loadClients(workspace.id),
    loadCurrentMemberId(workspace.id, session.user.id),
  ]);

  const professionals = team.filter((member) => {
    if (!member.hasProfessionalProfile) {
      return false;
    }
    if (workspace.role === "professional") {
      return member.memberId === currentMemberId;
    }
    return true;
  });
  const visibleAppointments = appointments.filter(
    (appointment) => appointment.status !== "cancelled" && appointment.status !== "no_show",
  );
  const confirmed = appointments.filter((appointment) => appointment.status === "confirmed").length;
  const inProgress = appointments.filter((appointment) => appointment.status === "in_progress").length;
  const revenue = visibleAppointments.reduce((sum, appointment) => sum + appointment.priceCents, 0);

  return (
    <>
      <PageHeader
        eyebrow="Agenda interna"
        title="Atendimentos"
        description="Visualize o ritmo do dia, filtre por profissional e conduza cada atendimento do agendamento à conclusão."
        icon={CalendarDays}
      />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo da agenda">
        <MetricCard label="Na agenda" value={visibleAppointments.length} hint={view === "week" ? "na semana selecionada" : "no dia selecionado"} icon={CalendarCheck2} />
        <MetricCard label="Confirmados" value={confirmed} hint="clientes confirmados" icon={Clock3} tone="success" />
        <MetricCard label="Em atendimento" value={inProgress} hint="acontecendo agora" icon={Clock3} tone="warning" />
        <MetricCard label="Valor previsto" value={formatCentsToReais(revenue)} hint="sem cancelamentos e faltas" icon={CircleDollarSign} tone="neutral" />
      </section>
      <AgendaBoard
        timezone={timezone}
        view={view}
        date={date}
        weekDates={weekDates}
        appointments={appointments}
        professionals={professionals}
        services={services.filter((service) => service.active)}
        clients={clients}
        selectedProfessionalId={professional}
        role={workspace.role}
        currentMemberId={currentMemberId}
      />
    </>
  );
}
