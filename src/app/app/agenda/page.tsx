import { requireConfirmedSession } from "@/lib/auth/session";
import { AgendaBoard } from "@/components/agenda/agenda-board";
import { loadClients, loadServices, loadTeam } from "@/lib/catalog/queries";
import { loadAgendaRange, loadCurrentMemberId } from "@/lib/agenda/queries";
import { addDaysIso, todayInProductTz, weekdayInProductTz, zonedWallTimeToUtc } from "@/lib/time/timezone";

function weekStart(date: string): string {
  const weekday = weekdayInProductTz(zonedWallTimeToUtc(date, "12:00"));
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
  const today = todayInProductTz();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : today;
  const view = params.view === "week" ? "week" : "day";
  const professional = params.professional && /^[0-9a-f-]{36}$/i.test(params.professional) ? params.professional : "";
  const fromDate = view === "week" ? weekStart(date) : date;
  const weekDates = Array.from({ length: 7 }, (_, index) => addDaysIso(fromDate, index));
  const toDateExclusive = view === "week" ? addDaysIso(fromDate, 7) : addDaysIso(date, 1);

  const [appointments, team, services, clients, currentMemberId] = await Promise.all([
    loadAgendaRange(workspace.id, fromDate, toDateExclusive, professional || undefined),
    loadTeam(workspace.id),
    loadServices(workspace.id),
    loadClients(workspace.id),
    loadCurrentMemberId(workspace.id, session.user.id),
  ]);

  const professionals = team.filter((member) => member.hasProfessionalProfile);

  return (
    <>
      <div>
        <p className="text-sm text-muted-foreground">Agenda interna</p>
        <h1 className="font-serif text-3xl">Atendimentos</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Horários em America/Sao_Paulo. No celular a agenda é uma lista do dia; a semana aparece em
          colunas só quando a tela comporta.
        </p>
      </div>
      <AgendaBoard
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
