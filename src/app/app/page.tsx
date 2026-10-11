import { requireConfirmedSession } from "@/lib/auth/session";
import { canAccessWorkspacePath } from "@/lib/auth/permissions";
import { ProfessionalDashboard, type DashboardMetric, type DashboardVisit } from "@/components/app/professional-dashboard";
import { loadClients, loadServices, loadTeam } from "@/lib/catalog/queries";
import { loadAgendaRange, loadWorkingHours } from "@/lib/agenda/queries";
import { loadReviewsResult } from "@/lib/reviews/queries";
import {
  averageRating,
  buildMonthGrid,
  dayCount,
  dayRevenueCents,
  daySnapshots,
  formatDashboardDate,
  formatRatingPt,
  monthTitle,
  parseMonthParam,
  percentChange,
  rangeCovering,
  shiftMonth,
  upcomingAppointments,
} from "@/lib/dashboard/summary";
import { formatDateTime } from "@/lib/workspace/timezone";
import { MEMBER_ROLE_LABEL, PLAN_LABEL, SUBSCRIPTION_STATUS_LABEL } from "@/lib/workspace/labels";
import { loadWorkspaceSettings } from "@/lib/workspace/queries";
import { addDaysIso, todayInTimeZone } from "@/lib/time/timezone";
import { formatCentsToReais } from "@/lib/validation/money";

function monthHref(month: string, setup?: string): string {
  const params = new URLSearchParams();
  if (setup === "1") {
    params.set("setup", "1");
  }
  params.set("mes", month);
  return `/app?${params.toString()}`;
}

export default async function AppPage({
  searchParams,
}: {
  searchParams: Promise<{ clientError?: string; setup?: string; mes?: string }>;
}) {
  const { clientError, setup, mes } = await searchParams;
  const session = await requireConfirmedSession("/app");
  const workspace = session.workspaces[0];
  const settings = workspace ? await loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug) : null;
  const timezone = settings?.timezone ?? "America/Sao_Paulo";
  const today = todayInTimeZone(timezone);
  const month = parseMonthParam(mes, today);
  const yesterday = addDaysIso(today, -1);
  const horizon = addDaysIso(today, 14);
  const monthStart = `${month}-01`;
  const monthEnd = shiftMonth(month, 1) + "-01";
  const range = rangeCovering([yesterday, today, horizon, monthStart, addDaysIso(monthEnd, -1)]);

  const [team, services, clients, appointments, reviewsResult] = workspace
    ? await Promise.all([
        loadTeam(workspace.id),
        loadServices(workspace.id),
        loadClients(workspace.id),
        loadAgendaRange(workspace.id, range.from, range.toExclusive),
        loadReviewsResult(workspace.id),
      ])
    : [[], [], [], [], { reviews: [], schemaReady: true }] as const;

  const guideMember =
    team.find((member) => member.hasProfessionalProfile && member.bookingEnabled !== false) ?? team[0];
  const workingHours =
    workspace && guideMember ? await loadWorkingHours(workspace.id, guideMember.memberId) : [];

  const activeServices = services.filter((service) => service.active);
  const servicesWithPros = activeServices.filter((service) => service.professionalMemberIds.length > 0);
  const setupSteps = [
    {
      done: servicesWithPros.length > 0,
      title: "Cadastre um serviço",
      href: "/app/servicos?novo=1",
      hint: "Ex.: Manicure — 1h — R$ 80. Marque quem faz.",
    },
    {
      done: workingHours.length > 0,
      title: "Defina horários de atendimento",
      href: guideMember ? `/app/equipe/${guideMember.memberId}/disponibilidade` : "/app/equipe",
      hint: "Informe os dias e as horas em que você atende.",
    },
    {
      done: servicesWithPros.length > 0 && workingHours.length > 0,
      title: "Envie o link para clientes",
      href: workspace ? `/p/${workspace.slug}` : "/app/configuracoes/geral",
      hint: "Copie e mande no WhatsApp. Elas marcam sozinhas.",
    },
  ] as const;
  const setupIncomplete = setupSteps.some((step) => !step.done);
  const firstName = session.profile.fullName.split(/\s+/)[0] || "profissional";
  const todayCount = dayCount(appointments, today);
  const yesterdayCount = dayCount(appointments, yesterday);
  const todayRevenue = dayRevenueCents(appointments, today);
  const yesterdayRevenue = dayRevenueCents(appointments, yesterday);
  const rating = reviewsResult.schemaReady ? averageRating(reviewsResult.reviews.map((review) => review.rating)) : null;
  const canOpenFinance = canAccessWorkspacePath("/app/financeiro", workspace?.role);
  const occupied = new Set(
    appointments.filter((item) => item.status !== "cancelled" && item.status !== "no_show").map((item) => item.localDate),
  );
  const visits: DashboardVisit[] = appointments.map((appointment) => ({
    id: appointment.id,
    clientName: appointment.clientName,
    serviceName: appointment.serviceName,
    professionalName: appointment.professionalName,
    localDate: appointment.localDate,
    localStart: appointment.localStart,
    status: appointment.status,
  }));
  const todayVisits = daySnapshots(visits, today);
  const cancelledToday = appointments.filter((item) => item.localDate === today && item.status === "cancelled").length;

  const metrics: DashboardMetric[] = [
    {
      label: "Agendamentos hoje",
      value: String(todayCount),
      hint: "Sem cancelados",
      href: `/app/agenda?date=${today}`,
      tone: "blush",
      delta: percentChange(todayCount, yesterdayCount),
    },
    {
      label: "Receita do dia",
      value: formatCentsToReais(todayRevenue),
      hint: "Soma dos horários, sem faltas",
      href: canOpenFinance ? "/app/financeiro" : `/app/agenda?date=${today}`,
      tone: "sand",
      delta: percentChange(todayRevenue, yesterdayRevenue),
    },
    {
      label: "Clientes ativos",
      value: String(clients.length),
      hint: "Cadastrados no salão",
      href: "/app/clientes",
      tone: "ivory",
      delta: null,
    },
    {
      label: "Avaliação média",
      value: rating === null ? "—" : formatRatingPt(rating),
      hint: !reviewsResult.schemaReady
        ? "Indisponíveis agora"
        : reviewsResult.reviews.length === 0
          ? "Nenhuma avaliação ainda"
          : reviewsResult.reviews.length === 1
            ? "1 avaliação recebida"
            : `${reviewsResult.reviews.length} avaliações recebidas`,
      href: "/app/avaliacoes",
      tone: "lilac",
      delta: null,
      stars: {
        filled: rating === null ? 0 : Math.round(rating),
        label: rating === null ? "Sem nota média" : `Nota ${formatRatingPt(rating)} de 5`,
      },
    },
  ];

  return (
    <ProfessionalDashboard
      firstName={firstName}
      salonName={workspace?.name ?? "Seu salão"}
      todayLabel={formatDashboardDate(today, timezone)}
      clientError={Boolean(clientError)}
      metrics={metrics}
      todayVisits={todayVisits}
      showProfessional={team.length > 1}
      cancelledToday={cancelledToday}
      upcoming={upcomingAppointments(visits, today)}
      calendar={{
        title: monthTitle(month),
        prevHref: monthHref(shiftMonth(month, -1), setup),
        nextHref: monthHref(shiftMonth(month, 1), setup),
        weeks: buildMonthGrid(month, today, occupied),
      }}
      setup={setupIncomplete ? {
        showWelcome: setup === "1",
        steps: [...setupSteps],
        nextHref: setupSteps.find((step) => !step.done)?.href ?? "/app/servicos",
        publicPath: workspace ? `/p/${workspace.slug}` : null,
      } : null}
      plan={{
        planLabel: PLAN_LABEL[session.subscription?.plan ?? "solo"],
        statusLabel: SUBSCRIPTION_STATUS_LABEL[session.subscription?.status ?? "expired"],
        trialStarted: formatDateTime(session.subscription?.trialStartedAt ?? null, timezone),
        trialEnds: formatDateTime(session.subscription?.trialEndsAt ?? null, timezone),
        roleLabel: workspace ? MEMBER_ROLE_LABEL[workspace.role] : "Profissional",
        publicPath: workspace ? `/p/${workspace.slug}` : null,
        hasClientProfile: session.context.hasClientProfile,
      }}
      primaryAction={setupIncomplete ? {
        href: setupSteps.find((step) => !step.done)?.href ?? "/app/servicos",
        label: "Fazer o próximo passo",
      } : {
        href: "/app/agenda?novo=1",
        label: "Novo horário",
      }}
    />
  );
}
