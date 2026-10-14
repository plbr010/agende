import { requireActiveWorkspace, requireConfirmedSession } from "@/lib/auth/session";
import { PublicProfileSettingsForm } from "@/components/workspace/settings-forms";
import { getRequestOrigin, hostFromOrigin } from "@/lib/http/origin";
import { isManagerRole, loadWorkspaceSettings } from "@/lib/workspace/queries";
import { createClient } from "@/lib/supabase/server";
import { DiscoveryPublicationForm } from "@/components/discovery/publication-form";

export default async function PublicProfileSettingsPage() {
  const session = await requireConfirmedSession("/app/configuracoes/perfil");
  const workspace = requireActiveWorkspace(session);
  const [settings, origin] = await Promise.all([
    loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug),
    getRequestOrigin(),
  ]);

  const canEdit = isManagerRole(workspace.role);
  const publication = canEdit ? await (await createClient()).rpc("get_workspace_discovery", { p_workspace_id: workspace.id }) : null;
  return (
    <div className="grid gap-6">
    <PublicProfileSettingsForm
      settings={settings}
      canEdit={isManagerRole(workspace.role)}
      host={hostFromOrigin(origin)}
    />
    {canEdit && publication && !publication.error ? <DiscoveryPublicationForm enabled={publication.data === true} /> : null}
    </div>
  );
}
