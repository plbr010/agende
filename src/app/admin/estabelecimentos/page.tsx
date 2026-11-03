import Link from "next/link";
import { Store } from "lucide-react";
import { AdminFilters } from "@/components/admin/filters";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminPager, AdminTable } from "@/components/admin/table";
import { PageHeader } from "@/components/app/page-header";
import { ADMIN_PLAN_OPTIONS, ADMIN_SUBSCRIPTION_STATUS_OPTIONS, formatCount } from "@/lib/admin/format";
import { requireReadyPlatformAdmin } from "@/lib/admin/guard";
import { clampQuery, optionalFilter, parsePage } from "@/lib/admin/params";
import { asBoolean, asNumber, asString, loadAdminWorkspaces } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/workspace/timezone";

export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string; status?: string; page?: string }>;
}) {
  await requireReadyPlatformAdmin("/admin/estabelecimentos");
  const params = await searchParams;
  const query = clampQuery(params.q);
  const plan = optionalFilter(params.plan, ADMIN_PLAN_OPTIONS.map((item) => item.value));
  const status = optionalFilter(params.status, [...ADMIN_SUBSCRIPTION_STATUS_OPTIONS.map((item) => item.value), "held"]);
  const page = parsePage(params.page);

  let data: Awaited<ReturnType<typeof loadAdminWorkspaces>>;
  try {
    data = await loadAdminWorkspaces({ query, plan, status, page });
  } catch (error) {
    return <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : "Erro ao carregar."}</p>;
  }

  return (
    <div className="grid gap-5">
      <PageHeader eyebrow="Gestão" title="Estabelecimentos" description="Salões da plataforma, plano contratado e volume de agenda." icon={Store} />
      <AdminFilters
        searchPlaceholder="Buscar salão, dono, e-mail ou cidade"
        selects={[
          { name: "plan", label: "Plano", options: [...ADMIN_PLAN_OPTIONS] },
          { name: "status", label: "Assinatura", options: [...ADMIN_SUBSCRIPTION_STATUS_OPTIONS, { value: "held", label: "Suspenso" }] },
        ]}
      />
      <AdminTable
        columns={["Estabelecimento", "Dono", "Plano", "Situação", "Agenda"]}
        isEmpty={data.items.length === 0}
        emptyIcon={Store}
        emptyTitle="Nenhum estabelecimento encontrado"
        emptyDescription="A busca usa o cadastro real de salões."
      >
        {data.items.map((row) => {
          const id = asString(row.id);
          if (!id) return null;
          return (
            <tr key={id} className="hover:bg-muted/40">
              <td className="px-4 py-3">
                <Link href={`/admin/estabelecimentos/${id}`} className="font-medium text-wine-deep underline-offset-4 hover:underline">
                  {asString(row.name)}
                </Link>
                <p className="text-xs text-muted-foreground">/{asString(row.slug)}</p>
              </td>
              <td className="px-4 py-3 text-sm">
                {asString(row.owner_name)}
                <p className="text-xs text-muted-foreground">{asString(row.owner_email)}</p>
              </td>
              <td className="px-4 py-3"><StatusBadge value={asString(row.plan)} kind="plan" /></td>
              <td className="px-4 py-3">
                {asBoolean(row.held) ? <StatusBadge value="held" kind="hold" /> : <StatusBadge value={asString(row.subscription_status)} />}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {formatCount(asNumber(row.appointment_count))} horários
                <p className="text-xs">{formatDateTime(asString(row.created_at))}</p>
              </td>
            </tr>
          );
        })}
      </AdminTable>
      <AdminPager path="/admin/estabelecimentos" page={page} total={data.total} params={{ q: query, plan, status }} />
    </div>
  );
}
