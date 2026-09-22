import { ContactRound, NotebookPen, Search, UsersRound } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { ClientDirectory } from "@/components/catalog/directories";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
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
  const withContact = clients.filter((client) => client.phone || client.email).length;
  const withNotes = clients.filter((client) => client.notes).length;

  return (
    <>
      <PageHeader
        eyebrow="Relacionamento"
        title="Clientes"
        description="Uma base organizada para acolher cada pessoa com contexto, contato e observações importantes."
        icon={UsersRound}
        actions={
          <form className="flex w-full gap-2 sm:w-auto sm:min-w-sm">
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Nome, telefone ou e-mail"
            className="h-11 bg-background/80"
          />
          <Button type="submit" variant="outline" className="h-11 rounded-xl" aria-label="Buscar clientes">
            <Search className="size-4" /> <span className="hidden sm:inline">Buscar</span>
          </Button>
        </form>
        }
      />
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo de clientes">
        <MetricCard label="Clientes ativos" value={clients.length} hint={q ? "no resultado da busca" : "na sua base"} icon={UsersRound} />
        <MetricCard label="Com contato" value={withContact} hint="telefone ou e-mail disponível" icon={ContactRound} tone="success" />
        <MetricCard label="Com observações" value={withNotes} hint="preferências registradas" icon={NotebookPen} tone="neutral" />
      </section>
      <ClientDirectory clients={clients} canEdit={canEditClients(workspace.role)} />
    </>
  );
}
