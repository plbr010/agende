import Link from "next/link";
import { Users } from "lucide-react";
import { AdminFilters } from "@/components/admin/filters";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminPager, AdminTable } from "@/components/admin/table";
import { PageHeader } from "@/components/app/page-header";
import { ADMIN_PLAN_OPTIONS, ADMIN_SUBSCRIPTION_STATUS_OPTIONS } from "@/lib/admin/format";
import { requireReadyPlatformAdmin } from "@/lib/admin/guard";
import { clampQuery, optionalFilter, parsePage } from "@/lib/admin/params";
import { asBoolean, asNumber, asString, loadAdminProfessionals } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/workspace/timezone";

export default async function AdminProfessionalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string; status?: string; page?: string }>;
}) {
  await requireReadyPlatformAdmin("/admin/profissionais");
  const params = await searchParams;
  const query = clampQuery(params.q);
  const plan = optionalFilter(params.plan, ADMIN_PLAN_OPTIONS.map((item) => item.value));
  const status = optionalFilter(params.status, [...ADMIN_SUBSCRIPTION_STATUS_OPTIONS.map((item) => item.value), "held", "none"]);
  const page = parsePage(params.page);

  let data: Awaited<ReturnType<typeof loadAdminProfessionals>>;
  try {
    data = await loadAdminProfessionals({ query, plan, status, page });
  } catch (error) {
    return <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : "Erro ao carregar."}</p>;
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Gestão"
        title="Profissionais"
        description="Todas as contas profissionais e membros de atendimento, com plano, estabelecimento e situação."
        icon={Users}
      />
      <AdminFilters
        searchPlaceholder="Buscar nome, e-mail, telefone ou salão"
        selects={[
          { name: "plan", label: "Plano", options: [...ADMIN_PLAN_OPTIONS] },
          {
            name: "status",
            label: "Assinatura",
            options: [
              ...ADMIN_SUBSCRIPTION_STATUS_OPTIONS,
              { value: "held", label: "Suspensa" },
              { value: "none", label: "Sem assinatura" },
            ],
          },
        ]}
      />
      <AdminTable
        columns={["Profissional", "Estabelecimento", "Plano", "Situação", "Cadastro"]}
        isEmpty={data.items.length === 0}
        emptyIcon={Users}
        emptyTitle="Nenhum profissional encontrado"
        emptyDescription="Ajuste a busca ou os filtros. Os números vêm do cadastro real."
      >
        {data.items.map((row) => {
          const id = asString(row.user_id);
          if (!id) return null;
          return (
            <tr key={id} className="hover:bg-muted/40">
              <td className="px-4 py-3">
                <Link href={`/admin/profissionais/${id}`} className="font-medium text-wine-deep underline-offset-4 hover:underline">
                  {asString(row.full_name) ?? "Sem nome"}
                </Link>
                <p className="text-xs text-muted-foreground">{asString(row.email)}</p>
                <p className="text-xs text-muted-foreground">{asString(row.phone) ?? "Sem telefone"}</p>
              </td>
              <td className="px-4 py-3 text-sm">{asString(row.workspace_name) ?? "—"}</td>
              <td className="px-4 py-3"><StatusBadge value={asString(row.plan)} kind="plan" /></td>
              <td className="px-4 py-3">
                {asBoolean(row.held) ? <StatusBadge value="held" kind="hold" /> : <StatusBadge value={asString(row.subscription_status)} />}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {formatDateTime(asString(row.created_at))}
                <p className="text-xs">{asNumber(row.appointment_count) ?? 0} agendamentos</p>
              </td>
            </tr>
          );
        })}
      </AdminTable>
      <AdminPager path="/admin/profissionais" page={page} total={data.total} params={{ q: query, plan, status }} />
    </div>
  );
}
