import Link from "next/link";
import { CreditCard } from "lucide-react";
import { AdminFilters } from "@/components/admin/filters";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminPager, AdminTable } from "@/components/admin/table";
import { PageHeader } from "@/components/app/page-header";
import { ADMIN_BILLING_KIND_LABEL, ADMIN_PLAN_OPTIONS, ADMIN_SUBSCRIPTION_STATUS_OPTIONS, billingKindLabel, formatCount, formatMoney } from "@/lib/admin/format";
import { requireReadyPlatformAdmin } from "@/lib/admin/guard";
import { clampQuery, optionalFilter, parsePage } from "@/lib/admin/params";
import { asNumber, asString, loadAdminBillingEvents, loadAdminSubscriptions } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/workspace/timezone";

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string; status?: string; kind?: string; page?: string; cobrancas?: string }>;
}) {
  await requireReadyPlatformAdmin("/admin/assinaturas");
  const params = await searchParams;
  const query = clampQuery(params.q);
  const plan = optionalFilter(params.plan, ADMIN_PLAN_OPTIONS.map((item) => item.value));
  const status = optionalFilter(params.status, ADMIN_SUBSCRIPTION_STATUS_OPTIONS.map((item) => item.value));
  const kind = optionalFilter(params.kind, Object.keys(ADMIN_BILLING_KIND_LABEL));
  const page = parsePage(params.page);
  const showCharges = params.cobrancas === "1";

  let subscriptions: Awaited<ReturnType<typeof loadAdminSubscriptions>> | null = null;
  let charges: Awaited<ReturnType<typeof loadAdminBillingEvents>> | null = null;
  try {
    if (showCharges) {
      charges = await loadAdminBillingEvents({ query, kind, page });
    } else {
      subscriptions = await loadAdminSubscriptions({ query, plan, status, page });
    }
  } catch (error) {
    return <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : "Erro ao carregar."}</p>;
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Financeiro"
        title="Assinaturas e cobranças"
        description="Consulta o Stripe já sincronizado no banco. Não há um segundo sistema de pagamento. Os planos reais são Solo, Equipe e Salão."
        icon={CreditCard}
        actions={
          <Link
            href={showCharges ? "/admin/assinaturas" : "/admin/assinaturas?cobrancas=1"}
            className="inline-flex min-h-11 items-center text-sm font-medium text-wine-deep underline underline-offset-4"
          >
            {showCharges ? "Ver assinaturas" : "Ver histórico de cobranças"}
          </Link>
        }
      />

      {showCharges ? (
        <>
          <AdminFilters
            searchPlaceholder="Buscar salão ou tipo de evento"
            selects={[{
              name: "kind",
              label: "Situação do pagamento",
              options: Object.entries(ADMIN_BILLING_KIND_LABEL).map(([value, label]) => ({ value, label })),
            }]}
          />
          <AdminTable
            columns={["Salão", "Evento", "Situação", "Valor", "Quando"]}
            isEmpty={!charges || charges.items.length === 0}
            emptyIcon={CreditCard}
            emptyTitle="Nenhuma cobrança registrada"
            emptyDescription="Os eventos vêm do webhook Stripe já existente."
          >
            {(charges?.items ?? []).map((row) => (
              <tr key={asString(row.id)} className="hover:bg-muted/40">
                <td className="px-4 py-3">
                  {asString(row.workspace_id) ? (
                    <Link href={`/admin/estabelecimentos/${asString(row.workspace_id)}`} className="text-wine-deep underline-offset-4 hover:underline">
                      {asString(row.workspace_name)}
                    </Link>
                  ) : asString(row.workspace_name)}
                </td>
                <td className="px-4 py-3 text-sm">{asString(row.event_type)}</td>
                <td className="px-4 py-3"><StatusBadge value={asString(row.kind)} kind="billing" /></td>
                <td className="px-4 py-3">{formatMoney(asNumber(row.amount_cents))}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{formatDateTime(asString(row.occurred_at))}</td>
              </tr>
            ))}
          </AdminTable>
          <AdminPager path="/admin/assinaturas" page={page} total={charges?.total ?? 0} params={{ q: query, kind, cobrancas: "1" }} />
        </>
      ) : (
        <>
          <AdminFilters
            searchPlaceholder="Buscar salão, dono ou e-mail"
            selects={[
              { name: "plan", label: "Plano", options: [...ADMIN_PLAN_OPTIONS] },
              { name: "status", label: "Situação", options: [...ADMIN_SUBSCRIPTION_STATUS_OPTIONS] },
            ]}
          />
          <AdminTable
            columns={["Estabelecimento", "Plano", "Valor", "Situação", "Vencimento", "Cobranças"]}
            isEmpty={!subscriptions || subscriptions.items.length === 0}
            emptyIcon={CreditCard}
            emptyTitle="Nenhuma assinatura encontrada"
            emptyDescription="A lista lê a tabela de assinaturas já usada pelo Stripe."
          >
            {(subscriptions?.items ?? []).map((row) => {
              const workspaceId = asString(row.workspace_id);
              return (
                <tr key={asString(row.id)} className="hover:bg-muted/40">
                  <td className="px-4 py-3">
                    {workspaceId ? (
                      <Link href={`/admin/estabelecimentos/${workspaceId}`} className="font-medium text-wine-deep underline-offset-4 hover:underline">
                        {asString(row.workspace_name)}
                      </Link>
                    ) : asString(row.workspace_name)}
                    <p className="text-xs text-muted-foreground">{asString(row.owner_email)}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge value={asString(row.plan)} kind="plan" /></td>
                  <td className="px-4 py-3">{formatMoney(asNumber(row.monthly_cents))}</td>
                  <td className="px-4 py-3"><StatusBadge value={asString(row.status)} /></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDateTime(asString(row.current_period_end) ?? asString(row.trial_ends_at))}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatCount(asNumber(row.paid_events))} ok · {formatCount(asNumber(row.pending_events))} pend. · {formatCount(asNumber(row.failed_events))} recus.
                  </td>
                </tr>
              );
            })}
          </AdminTable>
          <AdminPager path="/admin/assinaturas" page={page} total={subscriptions?.total ?? 0} params={{ q: query, plan, status }} />
        </>
      )}
      {showCharges ? <p className="sr-only">{billingKindLabel(kind)}</p> : null}
    </div>
  );
}
