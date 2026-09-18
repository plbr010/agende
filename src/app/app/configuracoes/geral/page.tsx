import { requireConfirmedSession } from "@/lib/auth/session";
import { GeneralSettingsForm } from "@/components/workspace/settings-forms";
import { isManagerRole, loadWorkspaceSettings } from "@/lib/workspace/queries";

export default async function GeneralSettingsPage() {
  const session = await requireConfirmedSession("/app/configuracoes/geral");
  const workspace = session.workspaces[0];
  if (!workspace) {
    return null;
  }
  const settings = await loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug);

  return (
    <GeneralSettingsForm settings={settings} canEdit={isManagerRole(workspace.role)} />
  );
}
