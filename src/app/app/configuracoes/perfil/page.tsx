import { requireConfirmedSession } from "@/lib/auth/session";
import { PublicProfileSettingsForm } from "@/components/workspace/settings-forms";
import { getRequestOrigin, hostFromOrigin } from "@/lib/http/origin";
import { isManagerRole, loadWorkspaceSettings } from "@/lib/workspace/queries";

export default async function PublicProfileSettingsPage() {
  const session = await requireConfirmedSession("/app/configuracoes/perfil");
  const workspace = session.workspaces[0];
  if (!workspace) {
    return null;
  }
  const [settings, origin] = await Promise.all([
    loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug),
    getRequestOrigin(),
  ]);

  return (
    <PublicProfileSettingsForm
      settings={settings}
      canEdit={isManagerRole(workspace.role)}
      host={hostFromOrigin(origin)}
    />
  );
}
