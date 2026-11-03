import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { AdminFilters } from "@/components/admin/filters";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminPager, AdminTable } from "@/components/admin/table";
import { MetricCard } from "@/components/app/metric-card";
import { PageHeader } from "@/components/app/page-header";
import { ADMIN_APPOINTMENT_STATUS_LABEL, formatCount, formatMoney } from "@/lib/admin/format";
import { requireReadyPlatformAdmin } from "@/lib/admin/guard";
import { clampQuery, optionalFilter, parsePage } from "@/lib/admin/params";
import { asNumber, asString, loadAdminAppointments } from "@/lib/admin/queries";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/workspace/timezone";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; de?: string; ate?: string; page?: string; salao?: string }>;
}) {
  await requireReadyPlatformAdmin("/admin/agendamentos");
  const params = await searchParams;
  const query = clampQuery(params.q);
  const status = optionalFilter(params.status, Object.keys(ADMIN_APPOINTMENT_STATUS_LABEL));
  const page = parsePage(params.page);
  const workspaceId = params.salao && UUID.test(params.salao) ? params.salao : null;
  const from = params.de && /^\d{4}-\d{2}-\d{2}$/.test(params.de) ? `${params.de}T00:00:00.000Z` : null;
  const to = params.ate && /^\d{4}-\d{2}-\d{2}$/.test(params.ate) ? `${params.ate}T23:59:59.999Z` : null;

  let data: Awaited<ReturnType<typeof loadAdminAppointments>>;
  try {
    data = await loadAdminAppointments({ query, status, workspaceId, from, to, page });
  } catch (error) {
    return <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : "Erro ao carregar."}</p>;
  }

  const counts = data.counts ?? {};

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Operação"
        title="Agendamentos"
        description="Visão geral da agenda da plataforma, sem alterar o fluxo público de marcação."
        icon={CalendarDays}
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total" value={formatCount(asNumber(counts.total))} hint="No recorte de datas" icon={CalendarDays} />
        <MetricCard label="Realizados" value={formatCount(asNumber(counts.completed))} hint="Status concluído" icon={CalendarDays} tone="success" />
        <MetricCard label="Cancelados" value={formatCount(asNumber(counts.cancelled))} hint="Inclui cancelamento do cliente ou do salão" icon={CalendarDays} tone="warning" />
        <MetricCard label="Pendentes" value={formatCount(asNumber(counts.pending))} hint="Agendados ou confirmados" icon={CalendarDays} />
      </section>
      <AdminFilters
        searchPlaceholder="Buscar cliente, profissional ou salão"
        selects={[{
          name: "status",
          label: "Status",
          options: Object.entries(ADMIN_APPOINTMENT_STATUS_LABEL).map(([value, label]) => ({ value, label })),
        }]}
      />
      <form className="grid gap-3 rounded-[1.5rem] bg-card p-4 ring-1 ring-primary/10 sm:grid-cols-[1fr_1fr_auto] sm:items-end" method="get">
        {query ? <input type="hidden" name="q" value={query} /> : null}
        {status ? <input type="hidden" name="status" value={status} /> : null}
        {workspaceId ? <input type="hidden" name="salao" value={workspaceId} /> : null}
        <div className="grid gap-2">
          <Label htmlFor="de">De</Label>
          <Input id="de" name="de" type="date" defaultValue={params.de ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ate">Até</Label>
          <Input id="ate" name="ate" type="date" defaultValue={params.ate ?? ""} />
        </div>
        <Button type="submit" variant="outline">Filtrar período</Button>
      </form>
      {workspaceId ? (
        <p className="text-sm text-muted-foreground">
          Recorte de um estabelecimento.{" "}
          <Link href="/admin/agendamentos" className="text-wine-deep underline underline-offset-4">
            Ver todos os salões
          </Link>
        </p>
      ) : null}
      <AdminTable
        columns={["Quando", "Salão", "Cliente", "Profissional", "Status", "Valor"]}
        isEmpty={data.items.length === 0}
        emptyIcon={CalendarDays}
        emptyTitle="Nenhum agendamento neste recorte"
        emptyDescription="Tente outro período, salão ou busca."
      >
        {data.items.map((row) => (
          <tr key={asString(row.id)} className="hover:bg-muted/40">
            <td className="px-4 py-3 text-sm">{formatDateTime(asString(row.starts_at))}</td>
            <td className="px-4 py-3">
              {asString(row.workspace_id) ? (
                <Link href={`/admin/estabelecimentos/${asString(row.workspace_id)}`} className="text-wine-deep underline-offset-4 hover:underline">
                  {asString(row.workspace_name)}
                </Link>
              ) : asString(row.workspace_name)}
            </td>
            <td className="px-4 py-3 text-sm">{asString(row.client_name)}</td>
            <td className="px-4 py-3 text-sm">{asString(row.professional_name)}</td>
            <td className="px-4 py-3"><StatusBadge value={asString(row.status)} kind="appointment" /></td>
            <td className="px-4 py-3">{formatMoney(asNumber(row.price_cents))}</td>
          </tr>
        ))}
      </AdminTable>
      <AdminPager
        path="/admin/agendamentos"
        page={page}
        total={data.total}
        params={{ q: query, status, de: params.de, ate: params.ate, salao: workspaceId }}
      />
    </div>
  );
}
