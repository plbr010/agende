import { requireConfirmedSession } from "@/lib/auth/session";
import { canManageAllProfiles, loadTeam } from "@/lib/catalog/queries";
import {
  MemberManagementList,
  PendingInvitesList,
  SeatUsageCard,
  TeamInviteCard,
} from "@/components/workspace/team-admin";
import {
  isManagerRole,
  loadPendingInvites,
  loadSeatUsage,
  loadWorkspaceSettings,
} from "@/lib/workspace/queries";

export default async function TeamSettingsPage() {
  const session = await requireConfirmedSession("/app/configuracoes/equipe");
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

  return (
    <>
      {seats ? <SeatUsageCard seats={seats} /> : null}
      <TeamInviteCard canManage={canManage} />
      <PendingInvitesList invites={invites} canManage={canManage} timezone={settings.timezone} />
      <MemberManagementList
        members={team}
        canManage={isManagerRole(workspace.role)}
        currentUserId={session.user.id}
        timezone={settings.timezone}
      />
    </>
  );
}
