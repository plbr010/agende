import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { HoldAccountForm } from "@/components/admin/hold-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { PageHeader } from "@/components/app/page-header";
import { adminActionLabel, billingKindLabel, formatCount, formatMoney, formatPlan } from "@/lib/admin/format";
import { requireReadyPlatformAdmin } from "@/lib/admin/guard";
import { asArray, asBoolean, asNumber, asString, loadAdminProfessional } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/workspace/timezone";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function AdminProfessionalDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireReadyPlatformAdmin("/admin/profissionais");
  const { userId } = await params;
  if (!UUID.test(userId)) notFound();

  let row: Record<string, unknown>;
  try {
    row = await loadAdminProfessional(userId);
  } catch {
    notFound();
  }

  const memberships = asArray(row.memberships);
  const history = asArray(row.admin_history);
  const billing = asArray(row.billing_events);
  const held = asBoolean(row.held);
  const name = asString(row.full_name) ?? "Profissional";

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Profissional"
        title={name}
        description={`${asString(row.email) ?? ""} · cadastrado em ${formatDateTime(asString(row.created_at))}`}
        icon={Users}
        actions={
          <HoldAccountForm
            subjectType="user"
            subjectId={userId}
            held={held}
            name={name}
            returnTo={`/admin/profissionais/${userId}`}
          />
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[1.25rem] bg-card p-4 ring-1 ring-primary/10">
          <p className="text-sm text-muted-foreground">Telefone</p>
          <p className="mt-1 font-medium">{asString(row.phone) ?? "—"}</p>
        </article>
        <article className="rounded-[1.25rem] bg-card p-4 ring-1 ring-primary/10">
          <p className="text-sm text-muted-foreground">E-mail confirmado</p>
          <p className="mt-1 font-medium">{asBoolean(row.email_confirmed) ? "Sim" : "Não"}</p>
        </article>
        <article className="rounded-[1.25rem] bg-card p-4 ring-1 ring-primary/10">
          <p className="text-sm text-muted-foreground">Situação</p>
          <div className="mt-1"><StatusBadge value={held ? "held" : "active"} kind="hold" /></div>
        </article>
      </section>

      <section className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
        <h2 className="font-medium text-wine-deep">Estabelecimentos e assinaturas</h2>
        <div className="mt-4 grid gap-3">
          {memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum estabelecimento vinculado.</p>
          ) : memberships.map((membership) => {
            const workspaceId = asString(membership.workspace_id);
            return (
              <div key={asString(membership.member_id)} className="rounded-2xl bg-muted/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {workspaceId ? (
                    <Link href={`/admin/estabelecimentos/${workspaceId}`} className="font-medium text-wine-deep underline-offset-4 hover:underline">
                      {asString(membership.workspace_name)}
                    </Link>
                  ) : (
                    <p className="font-medium">{asString(membership.workspace_name)}</p>
                  )}
                  <StatusBadge value={asString(membership.subscription_status)} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Função {asString(membership.role)} · {formatPlan(asString(membership.plan))} · {formatCount(asNumber(membership.appointment_count))} agendamentos
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
        <h2 className="font-medium text-wine-deep">Cobranças Stripe</h2>
        <div className="mt-4 grid gap-2">
          {billing.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento de cobrança registrado para os salões desta conta.</p>
          ) : billing.map((event) => (
            <div key={asString(event.id)} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{asString(event.event_type)}</span>
              <span>{billingKindLabel(asString(event.kind))}</span>
              <span>{formatMoney(asNumber(event.amount_cents))}</span>
              <span className="text-muted-foreground">{formatDateTime(asString(event.occurred_at))}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
        <h2 className="font-medium text-wine-deep">Histórico administrativo</h2>
        <div className="mt-4 grid gap-2">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma ação master registrada nesta conta.</p>
          ) : history.map((event) => (
            <p key={asString(event.id)} className="text-sm">
              {adminActionLabel(asString(event.action) ?? "")} · {formatDateTime(asString(event.created_at))}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}
