import { requireActiveWorkspace, requireConfirmedSession } from "@/lib/auth/session";
import { PublicProfileSettingsForm } from "@/components/workspace/settings-forms";
import { getRequestOrigin, hostFromOrigin } from "@/lib/http/origin";
import { isManagerRole, loadWorkspaceSettings } from "@/lib/workspace/queries";
import { createClient } from "@/lib/supabase/server";
import { DiscoveryPublicationForm } from "@/components/discovery/publication-form";
import { DiscoveryPublicationUnavailable } from "@/components/discovery/discovery-unavailable";
import { WorkspaceImageForm } from "@/components/workspace/image-form";
import { publicLogoUrl } from "@/lib/workspace/public";

export default async function PublicProfileSettingsPage() {
  const session = await requireConfirmedSession("/app/configuracoes/perfil");
  const workspace = requireActiveWorkspace(session);
  const [settings, origin] = await Promise.all([
    loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug),
    getRequestOrigin(),
  ]);

  const canEdit = isManagerRole(workspace.role);
  const publication = canEdit ? await (await createClient()).rpc("get_workspace_discovery", { p_workspace_id: workspace.id }) : null;
  const media = canEdit ? await (await createClient()).from("workspace_settings").select("logo_path, cover_path").eq("workspace_id", workspace.id).single() : null;
  return (
    <div className="grid gap-6">
      <PublicProfileSettingsForm
        settings={settings}
        canEdit={isManagerRole(workspace.role)}
        host={hostFromOrigin(origin)}
      />
      {canEdit && media && !media.error ? <section className="grid gap-4 rounded-3xl bg-card p-6 ring-1 ring-border">
        <h2 className="font-serif text-2xl">Imagens públicas do estabelecimento</h2>
        <WorkspaceImageForm kind="logo" url={publicLogoUrl(media.data.logo_path)} />
        <WorkspaceImageForm kind="cover" url={publicLogoUrl(media.data.cover_path)} />
      </section> : canEdit ? <p role="status" className="text-sm text-muted-foreground">O envio de imagens públicas está temporariamente indisponível. Tente novamente mais tarde.</p> : null}
      {canEdit && publication?.error ? <DiscoveryPublicationUnavailable /> : null}
      {canEdit && publication && !publication.error ? (
        <DiscoveryPublicationForm enabled={publication.data === true} />
      ) : null}
    </div>
  );
}
