import Link from "next/link";
import { notFound } from "next/navigation";
import { Store } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { SalonStatusBadge } from "@/components/admin/salon-status";
import { requireReadyPlatformAdmin } from "@/lib/admin/guard";
import { asArray, asNumber, asString, loadAdminSalonOverview, loadAdminWorkspace } from "@/lib/admin/queries";
import { formatMoney, formatPlan, billingKindLabel } from "@/lib/admin/format";
import { trialDays } from "@/lib/admin/salon-status";
import { formatDateTime } from "@/lib/workspace/timezone";

export default async function SalonDetails({ params }: { params: Promise<{ workspaceId: string }> }) {
  await requireReadyPlatformAdmin("/admin/estabelecimentos");
  const { workspaceId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)) notFound();
  let detail: Record<string, unknown>;
  let snapshot: Awaited<ReturnType<typeof loadAdminSalonOverview>>;
  try {
    [detail, snapshot] = await Promise.all([loadAdminWorkspace(workspaceId), loadAdminSalonOverview({ workspaceId })]);
  } catch {
    return <p role="alert" className="rounded-2xl bg-card p-6 text-sm text-destructive">Não foi possível verificar este salão. Tente novamente.</p>;
  }
  const row = snapshot.items[0];
  if (!row) notFound();
  const payments = asArray(detail.billing_events);
  const days = trialDays(row.status, asString(row.trial_ends_at), snapshot.as_of);
  const fields = [
    ["Proprietário", asString(row.owner_name) ?? "—"],
    ["E-mail de contato", asString(row.owner_email) ?? "—"],
    ["Plano atual", formatPlan(asString(row.plan))],
    ["Cadastro", formatDateTime(asString(row.created_at))],
    ["Início do trial", formatDateTime(asString(row.trial_started_at))],
    ["Término do trial", formatDateTime(asString(row.trial_ends_at))],
    ["Dias restantes do trial", days === null ? "Não se aplica" : String(days)],
    ["Periodicidade", row.billing_interval === "annual" ? "Anual" : row.billing_interval === "monthly" ? "Mensal" : "—"],
    ["Início do período", formatDateTime(asString(row.current_period_start))],
    ["Fim do período", formatDateTime(asString(row.current_period_end))],
    ["Próximo vencimento", "Não confirmado pela sincronização atual"],
    ["Cancelamento agendado", "Não verificado: o campo não é persistido atualmente"],
    ["Identificador da assinatura Stripe", asString(row.external_subscription_id) ?? "Não vinculado"],
    ["Evidência de status recebida em", formatDateTime(asString(row.evidence_at))],
  ];
  return <div className="grid gap-5">
    <PageHeader eyebrow="Consulta do salão" title={asString(row.name) ?? "Salão"} description="Cadastro e situação da assinatura. Nenhuma alteração é realizada nesta tela." icon={Store} />
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <SalonStatusBadge value={row.status} />
      {row.lifetime === true ? <p className="mt-3 text-sm text-muted-foreground">Este salão tem acesso vitalício. Esse benefício não é uma assinatura paga.</p> : null}
      {row.status === "unverified" ? <p className="mt-3 text-sm text-muted-foreground">Não há evidência suficiente para confirmar a situação financeira atual. Indisponibilidade não significa inadimplência.</p> : null}
      <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {fields.map(([label, value]) => <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm">{value}</dd>
        </div>)}
      </dl>
    </section>
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="font-medium text-wine-deep">Histórico de pagamentos disponível</h2>
      <p className="mt-1 text-xs text-muted-foreground">Até os 50 eventos mais recentes sincronizados; não representa uma consulta ao Stripe em tempo real.</p>
      {payments.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Nenhum evento de cobrança disponível.</p> :
        <ul className="mt-4 divide-y divide-border">
          {payments.map((event) => <li key={asString(event.id)} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
            <div><p>{asString(event.event_type) ?? "Evento de cobrança"}</p><p className="text-xs text-muted-foreground">{formatDateTime(asString(event.occurred_at))}</p></div>
            <span>{billingKindLabel(asString(event.kind))}</span>
            <span>{asString(event.currency)?.toUpperCase() === "BRL" ? formatMoney(asNumber(event.amount_cents)) : "Valor em outra moeda não convertido"}</span>
          </li>)}
        </ul>}
    </section>
    <div className="flex flex-wrap gap-4 text-sm">
      <Link href="/admin/estabelecimentos" className="inline-flex min-h-11 items-center text-wine-deep underline">Voltar aos salões</Link>
      <Link href={`/admin/estabelecimentos/${workspaceId}/gestao`} className="inline-flex min-h-11 items-center text-muted-foreground underline">Abrir gestão administrativa existente</Link>
    </div>
  </div>;
}
