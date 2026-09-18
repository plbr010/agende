import { requireConfirmedSession } from "@/lib/auth/session";
import { TeamDirectory } from "@/components/catalog/directories";
import { canManageAllProfiles, loadTeam } from "@/lib/catalog/queries";

export default async function TeamPage() {
  const session = await requireConfirmedSession("/app/equipe");
  const workspace = session.workspaces[0];
  if (!workspace) {
    return null;
  }
  const team = await loadTeam(workspace.id);

  return (
    <>
      <div>
        <p className="text-sm text-muted-foreground">Equipe</p>
        <h1 className="font-serif text-3xl">Quem faz parte do negócio</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Perfis de atendimento existem só para dono, admin e profissional. Recepção não ocupa
          vaga e não aparece como quem realiza serviços.
        </p>
      </div>
      <TeamDirectory
        members={team}
        currentUserId={session.user.id}
        canManage={canManageAllProfiles(workspace.role)}
      />
    </>
  );
}
