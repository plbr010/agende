import { CalendarClock, Sparkles, UserRoundCheck, UsersRound } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { TeamDirectory } from "@/components/catalog/directories";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import {
  PendingInvitesList,
  SeatUsageCard,
  TeamInviteCard,
} from "@/components/workspace/team-admin";
import { canManageAllProfiles, loadTeam } from "@/lib/catalog/queries";
import {
  loadPendingInvites,
  loadSeatUsage,
  loadWorkspaceSettings,
} from "@/lib/workspace/queries";

export default async function TeamPage() {
  const session = await requireConfirmedSession("/app/equipe");
  const workspace = session.workspaces[0];
  if (!workspace) {
    return null;
  }
  const canManage = canManageAllProfiles(workspace.role);
  const [team, seats, invites, settings] = await Promise.all([
    loadTeam(workspace.id),
    loadSeatUsage(workspace.id),
    loadPendingInvites(workspace.id),
    loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug),
  ]);
  const activeMembers = team.filter((member) => member.status === "active").length;
  const bookableMembers = team.filter((member) => member.bookingEnabled).length;
  const linkedServices = team.reduce((sum, member) => sum + member.serviceCount, 0);

  return (
    <>
      <PageHeader
        eyebrow="Pessoas"
        title="Equipe"
        description="Quem atende, o que cada pessoa faz e os horários de trabalho."
        icon={UsersRound}
      />
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo da equipe">
        <MetricCard label="Pessoas ativas" value={activeMembers} hint="pessoas na equipe" icon={UserRoundCheck} />
        <MetricCard label="Na agenda" value={bookableMembers} hint="quem recebe reservas" icon={CalendarClock} tone="success" />
        <MetricCard label="Serviços por profissional" value={linkedServices} hint="o que cada pessoa faz" icon={Sparkles} tone="neutral" />
      </section>
      {seats ? <SeatUsageCard seats={seats} /> : null}
      <TeamInviteCard canManage={canManage} />
      <PendingInvitesList invites={invites} canManage={canManage} timezone={settings.timezone} />
      <TeamDirectory
        members={team}
        currentUserId={session.user.id}
        canManage={canManage}
      />
    </>
  );
}
