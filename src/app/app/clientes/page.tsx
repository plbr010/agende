import { requireConfirmedSession } from "@/lib/auth/session";
import { ClientDirectory } from "@/components/catalog/directories";
import { canEditClients, loadClients } from "@/lib/catalog/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireConfirmedSession("/app/clientes");
  const workspace = session.workspaces[0];
  if (!workspace) {
    return null;
  }
  const { q } = await searchParams;
  const clients = await loadClients(workspace.id, q);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Clientes</p>
          <h1 className="font-serif text-3xl">Cadastro do estabelecimento</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Independente da área /cliente. Serve para registrar pessoas que ainda não têm conta no
            Agendê.
          </p>
        </div>
        <form className="flex w-full gap-2 sm:max-w-sm">
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Nome, telefone ou e-mail"
            className="h-11"
          />
          <Button type="submit" variant="outline" className="h-11">
            Buscar
          </Button>
        </form>
      </div>
      <ClientDirectory clients={clients} canEdit={canEditClients(workspace.role)} />
    </>
  );
}
