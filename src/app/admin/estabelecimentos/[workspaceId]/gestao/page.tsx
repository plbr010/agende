import Link from "next/link";
import { notFound } from "next/navigation";
import { Store } from "lucide-react";
import { HoldAccountForm } from "@/components/admin/hold-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { PageHeader } from "@/components/app/page-header";
import { adminActionLabel, billingKindLabel, formatCount, formatMoney, formatPlan } from "@/lib/admin/format";
import { requireReadyPlatformAdmin } from "@/lib/admin/guard";
import { asArray, asBoolean, asNumber, asString, loadAdminWorkspace } from "@/lib/admin/queries";
import { MEMBER_ROLE_LABEL, MEMBER_STATUS_LABEL } from "@/lib/workspace/labels";
import { formatDateTime } from "@/lib/workspace/timezone";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function AdminWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  await requireReadyPlatformAdmin("/admin/estabelecimentos");
  const { workspaceId } = await params;
  if (!UUID.test(workspaceId)) notFound();

  let row: Record<string, unknown>;
  try {
    row = await loadAdminWorkspace(workspaceId);
  } catch {
    notFound();
  }

  const settings = (row.settings && typeof row.settings === "object" && !Array.isArray(row.settings))
    ? row.settings as Record<string, unknown>
    : {};
  const subscription = (row.subscription && typeof row.subscription === "object" && !Array.isArray(row.subscription))
    ? row.subscription as Record<string, unknown>
    : {};
  const members = asArray(row.members);
  const billing = asArray(row.billing_events);
  const history = asArray(row.admin_history);
  const held = asBoolean(row.held);
  const name = asString(row.name) ?? "Estabelecimento";

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Estabelecimento"
        title={name}
        description={`/${asString(row.slug)} · desde ${formatDateTime(asString(row.created_at))}`}
        icon={Store}
        actions={
          <HoldAccountForm
            subjectType="workspace"
            subjectId={workspaceId}
            held={held}
            name={name}
            returnTo={`/admin/estabelecimentos/${workspaceId}`}
          />
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[1.25rem] bg-card p-4 ring-1 ring-primary/10">
          <p className="text-sm text-muted-foreground">Plano</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge value={asString(subscription.plan)} kind="plan" />
            {held ? <StatusBadge value="held" kind="hold" /> : <StatusBadge value={asString(subscription.status)} />}
          </div>
          <p className="mt-2 text-sm">{formatMoney(asNumber(subscription.monthly_cents))} / mês equivalente</p>
        </article>
        <article className="rounded-[1.25rem] bg-card p-4 ring-1 ring-primary/10">
          <p className="text-sm text-muted-foreground">Cidade</p>
          <p className="mt-1 font-medium">{[asString(settings.city), asString(settings.state)].filter(Boolean).join(" · ") || "—"}</p>
        </article>
        <article className="rounded-[1.25rem] bg-card p-4 ring-1 ring-primary/10">
          <p className="text-sm text-muted-foreground">Agendamentos</p>
          <p className="mt-1 font-serif text-3xl text-wine-deep">{formatCount(asNumber(row.appointment_count))}</p>
          <Link href={`/admin/agendamentos?salao=${workspaceId}`} className="mt-2 inline-block text-sm text-wine-deep underline underline-offset-4">
            Ver na agenda master
          </Link>
        </article>
      </section>

      <section className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
        <h2 className="font-medium text-wine-deep">Equipe</h2>
        <div className="mt-4 grid gap-2">
          {members.map((member) => {
            const userId = asString(member.user_id);
            const role = asString(member.role);
            const status = asString(member.status);
            return (
              <div key={asString(member.member_id)} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                {userId ? (
                  <Link href={`/admin/profissionais/${userId}`} className="font-medium text-wine-deep underline-offset-4 hover:underline">
                    {asString(member.full_name)}
                  </Link>
                ) : <span>{asString(member.full_name)}</span>}
                <span className="text-muted-foreground">
                  {role && role in MEMBER_ROLE_LABEL ? MEMBER_ROLE_LABEL[role as keyof typeof MEMBER_ROLE_LABEL] : role}
                  {" · "}
                  {status && status in MEMBER_STATUS_LABEL ? MEMBER_STATUS_LABEL[status as keyof typeof MEMBER_STATUS_LABEL] : status}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
        <h2 className="font-medium text-wine-deep">Assinatura Stripe</h2>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Plano</dt><dd>{formatPlan(asString(subscription.plan))}</dd></div>
          <div><dt className="text-muted-foreground">Provedor</dt><dd>{asString(subscription.billing_provider) ?? "—"}</dd></div>
          <div><dt className="text-muted-foreground">Período atual</dt><dd>{formatDateTime(asString(subscription.current_period_end))}</dd></div>
          <div><dt className="text-muted-foreground">Trial até</dt><dd>{formatDateTime(asString(subscription.trial_ends_at))}</dd></div>
        </dl>
      </section>

      <section className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
        <h2 className="font-medium text-wine-deep">Histórico de cobranças</h2>
        <div className="mt-4 grid gap-2">
          {billing.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma cobrança sincronizada ainda.</p> : billing.map((event) => (
            <div key={asString(event.id)} className="flex flex-wrap justify-between gap-2 text-sm">
              <span>{asString(event.event_type)}</span>
              <span>{billingKindLabel(asString(event.kind))}</span>
              <span>{formatMoney(asNumber(event.amount_cents))}</span>
              <span className="text-muted-foreground">{formatDateTime(asString(event.occurred_at))}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
        <h2 className="font-medium text-wine-deep">Ações administrativas</h2>
        <div className="mt-4 grid gap-2">
          {history.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma suspensão ou reativação neste salão.</p> : history.map((event) => (
            <p key={asString(event.id)} className="text-sm">{adminActionLabel(asString(event.action) ?? "")} · {formatDateTime(asString(event.created_at))}</p>
          ))}
        </div>
      </section>
    </div>
  );
}
