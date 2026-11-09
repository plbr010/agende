import Link from "next/link";
import { Building2, Clock3, CreditCard, CircleAlert } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { MetricCard } from "@/components/app/metric-card";
import { AdminPager, AdminTable } from "@/components/admin/table";
import { SalonStatusBadge } from "@/components/admin/salon-status";
import { StatusBadge } from "@/components/admin/status-badge";
import { SALON_FILTERS, trialDays } from "@/lib/admin/salon-status";
import { clampQuery, optionalFilter, parsePage, withParams } from "@/lib/admin/params";
import { formatCount } from "@/lib/admin/format";
import { asString, loadAdminSalonOverview } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/workspace/timezone";

export type SalonSearch = { q?: string; status?: string; page?: string };
export async function SalonDirectory({ path, params, overview = false, title }: {
  path: string; params: SalonSearch; overview?: boolean; title?: string;
}) {
  const q = clampQuery(params.q);
  const status = optionalFilter(params.status, SALON_FILTERS.map((filter) => filter.value)) || null;
  const page = parsePage(params.page);
  let data: Awaited<ReturnType<typeof loadAdminSalonOverview>>;
  try { data = await loadAdminSalonOverview({ query: q, status, page }); }
  catch { return <div role="alert" className="rounded-2xl bg-card p-6 text-sm text-destructive ring-1 ring-border">
    Não foi possível consultar os salões. Nenhum indicador foi estimado. Tente novamente; se persistir, verifique a disponibilidade do modelo de consulta administrativo.
  </div>; }
  return <div className="grid gap-6">
    <PageHeader eyebrow="Master Admin" title={title ?? (overview ? "Visão geral" : "Salões")}
      description="Estabelecimentos e assinaturas, em uma única visão." icon={Building2} />
    {overview ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de salões">
      <MetricCard label="Salões cadastrados" value={formatCount(data.counts.total)} hint="Todos os estabelecimentos" icon={Building2} tone="neutral" />
      <MetricCard label="Em teste gratuito" value={formatCount(data.counts.trial)} hint="Trials dentro do prazo" icon={Clock3} />
      <MetricCard label="Assinatura paga ativa" value={formatCount(data.counts.paid)} hint="Período vigente com pagamento registrado" icon={CreditCard} tone="success" />
      <MetricCard label="Inadimplentes" value={formatCount(data.counts.delinquent)} hint="past_due ou unpaid confirmados no histórico" icon={CircleAlert} tone="warning" />
    </section> : null}
    <p className="text-xs leading-5 text-muted-foreground">
      Dados sincronizados no Supabase · consulta em {formatDateTime(data.as_of)}.
      {" "}Sem consulta financeira em tempo real.
      {data.counts.unverified > 0 ? ` ${formatCount(data.counts.unverified)} salões com status não verificado não entram nas contagens de pagos ou inadimplentes.` : ""}
      {" "}A sincronização atual não informa cancelamentos agendados nem a data exata da próxima fatura.
    </p>
    <section className="grid min-w-0 gap-4" aria-label="Consulta de salões">
      <form action={path} className="flex flex-col gap-2 sm:flex-row" role="search">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Buscar salão ou proprietário</span>
          <input name="q" defaultValue={q ?? ""} maxLength={80} placeholder="Buscar salão ou proprietário"
            className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-primary" />
        </label>
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <button type="submit" className="min-h-11 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground">Buscar</button>
        {q ? <Link href={withParams(path, { status })} className="flex min-h-11 items-center px-3 text-sm text-wine-deep underline">Limpar busca</Link> : null}
      </form>
      <nav className="flex flex-wrap gap-2" aria-label="Filtrar salões por assinatura">
        {SALON_FILTERS.map((filter) => <Link key={filter.value} href={withParams(path, { q, status: filter.value })}
          aria-current={(status ?? "") === filter.value ? "page" : undefined}
          className={`inline-flex min-h-10 items-center rounded-full px-3 text-sm ${(status ?? "") === filter.value ? "bg-primary text-primary-foreground" : "bg-card text-wine-deep ring-1 ring-border hover:bg-muted"}`}>
          {filter.label}
        </Link>)}
      </nav>
      <p className="text-sm text-muted-foreground" role="status">{formatCount(data.total)} salões encontrados</p>
      <AdminTable columns={["Salão", "Proprietário", "Contato", "Plano", "Assinatura", "Início do teste", "Dias restantes", "Período / vencimento", "Detalhes"]}
        isEmpty={data.items.length === 0} emptyIcon={Building2} emptyTitle="Nenhum salão encontrado" emptyDescription="Experimente outra busca ou filtro.">
        {data.items.map((row) => {
          const id = asString(row.id);
          if (!id) return null;
          const days = trialDays(row.status, asString(row.trial_ends_at), data.as_of);
          return <tr key={id} className="align-top hover:bg-muted/30">
            <td className="min-w-40 px-4 py-4 font-medium text-wine-deep">{asString(row.name) ?? "—"}</td>
            <td className="min-w-36 px-4 py-4">{asString(row.owner_name) ?? "—"}</td>
            <td className="max-w-64 break-words px-4 py-4 text-muted-foreground">{asString(row.owner_email) ?? "—"}</td>
            <td className="px-4 py-4"><StatusBadge value={asString(row.plan)} kind="plan" /></td>
            <td className="min-w-44 px-4 py-4"><SalonStatusBadge value={row.status} />
              {row.lifetime === true ? <p className="mt-1 text-xs text-muted-foreground">Acesso vitalício preservado</p> : null}
            </td>
            <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{formatDateTime(asString(row.trial_started_at))}</td>
            <td className="px-4 py-4">{days === null ? "—" : `${days} ${days === 1 ? "dia" : "dias"}`}</td>
            <td className="min-w-44 px-4 py-4 text-muted-foreground">{formatDateTime(asString(row.current_period_end))}
              <p className="mt-1 text-xs">Fim do período registrado; próxima cobrança não confirmada.</p>
            </td>
            <td className="whitespace-nowrap px-4 py-4"><Link href={`/admin/estabelecimentos/${id}`}
              aria-label={`Ver detalhes de ${asString(row.name) ?? "salão"}`}
              className="inline-flex min-h-10 items-center rounded-xl border border-border px-3 font-medium text-wine-deep hover:bg-muted">Ver detalhes</Link></td>
          </tr>;
        })}
      </AdminTable>
      <AdminPager path={path} page={page} total={data.total} params={{ q, status }} />
    </section>
  </div>;
}
