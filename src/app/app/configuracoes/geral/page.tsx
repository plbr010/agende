import { requireActiveWorkspace, requireConfirmedSession } from "@/lib/auth/session";
import { AccountPhotoEditor } from "@/components/account/account-photo-editor";
import { GeneralSettingsForm } from "@/components/workspace/settings-forms";
import { isManagerRole, loadWorkspaceSettings } from "@/lib/workspace/queries";

export default async function GeneralSettingsPage() {
  const session = await requireConfirmedSession("/app/configuracoes/geral");
  const workspace = requireActiveWorkspace(session);
  const settings = await loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug);

  return (
    <div className="grid gap-6">
      <section id="foto-da-conta" className="rounded-[1.8rem] bg-white p-6 ring-1 ring-[#f0e4de] sm:p-8">
        <h2 className="font-serif text-2xl text-wine-deep">Foto da sua conta</h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
          Esta foto é só da sua conta. Ela não aparece na página pública do salão.
        </p>
        <div className="mt-6">
          <AccountPhotoEditor
            name={session.profile.fullName}
            hasAvatar={session.profile.hasAvatar}
            version={session.profile.avatarVersion}
          />
        </div>
      </section>
      <GeneralSettingsForm settings={settings} canEdit={isManagerRole(workspace.role)} />
    </div>
  );
}
