import Link from "next/link";
import { UsersRound } from "lucide-react";
import { AdminFilters } from "@/components/admin/filters";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminPager, AdminTable } from "@/components/admin/table";
import { PageHeader } from "@/components/app/page-header";
import { requireReadyPlatformAdmin } from "@/lib/admin/guard";
import { clampQuery, optionalFilter, parsePage } from "@/lib/admin/params";
import { asBoolean, asNumber, asString, loadAdminClients } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/workspace/timezone";

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireReadyPlatformAdmin("/admin/clientes");
  const params = await searchParams;
  const query = clampQuery(params.q);
  const status = optionalFilter(params.status, ["active", "unconfirmed", "held"]);
  const page = parsePage(params.page);

  let data: Awaited<ReturnType<typeof loadAdminClients>>;
  try {
    data = await loadAdminClients({ query, status, page });
  } catch (error) {
    return <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : "Erro ao carregar."}</p>;
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Gestão"
        title="Clientes"
        description="Contas de cliente da plataforma. Senhas, tokens e dados desnecessários não aparecem aqui."
        icon={UsersRound}
      />
      <AdminFilters
        searchPlaceholder="Buscar nome, e-mail ou telefone"
        selects={[{
          name: "status",
          label: "Situação",
          options: [
            { value: "active", label: "Ativa" },
            { value: "unconfirmed", label: "E-mail não confirmado" },
            { value: "held", label: "Suspensa" },
          ],
        }]}
      />
      <AdminTable
        columns={["Cliente", "Contato", "Situação", "Cadastro"]}
        isEmpty={data.items.length === 0}
        emptyIcon={UsersRound}
        emptyTitle="Nenhum cliente encontrado"
        emptyDescription="A lista usa apenas contas de cliente cadastradas."
      >
        {data.items.map((row) => {
          const id = asString(row.user_id);
          if (!id) return null;
          return (
            <tr key={id} className="hover:bg-muted/40">
              <td className="px-4 py-3">
                <Link href={`/admin/clientes/${id}`} className="font-medium text-wine-deep underline-offset-4 hover:underline">
                  {asString(row.full_name)}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm">
                {asString(row.email)}
                <p className="text-xs text-muted-foreground">{asString(row.phone) ?? "Sem telefone"}</p>
              </td>
              <td className="px-4 py-3">
                {asBoolean(row.held) ? <StatusBadge value="held" kind="hold" /> : <StatusBadge value={asBoolean(row.email_confirmed) ? "active" : "expired"} />}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {formatDateTime(asString(row.created_at))}
                <p className="text-xs">{asNumber(row.favorite_count) ?? 0} favoritos</p>
              </td>
            </tr>
          );
        })}
      </AdminTable>
      <AdminPager path="/admin/clientes" page={page} total={data.total} params={{ q: query, status }} />
    </div>
  );
}
