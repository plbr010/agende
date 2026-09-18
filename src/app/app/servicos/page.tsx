import { requireConfirmedSession } from "@/lib/auth/session";
import { ServiceCatalog } from "@/components/catalog/directories";
import { canManageServices, loadServices, loadTeam } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireConfirmedSession("/app/servicos");
  const workspace = session.workspaces[0];
  if (!workspace) {
    return null;
  }
  const { q } = await searchParams;
  const [services, team] = await Promise.all([
    loadServices(workspace.id, q),
    loadTeam(workspace.id),
  ]);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Serviços</p>
          <h1 className="font-serif text-3xl">Catálogo do salão</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Duração e preço ficam no servidor. O valor que você vê em reais é gravado em centavos.
          </p>
        </div>
        <form className="flex w-full gap-2 sm:max-w-sm">
          <Input name="q" defaultValue={q ?? ""} placeholder="Buscar serviço" className="h-11" />
          <Button type="submit" variant="outline" className="h-11">
            Buscar
          </Button>
        </form>
      </div>
      <ServiceCatalog
        services={services}
        professionals={team}
        canManage={canManageServices(workspace.role)}
        currentMemberId={team.find((member) => member.userId === session.user.id)?.memberId ?? null}
      />
    </>
  );
}
