import Link from "next/link";
import { notFound } from "next/navigation";
import { UsersRound } from "lucide-react";
import { HoldAccountForm } from "@/components/admin/hold-form";
import { StatusBadge } from "@/components/admin/status-badge";
import { PageHeader } from "@/components/app/page-header";
import { appointmentStatusLabel, formatMoney } from "@/lib/admin/format";
import { requireReadyPlatformAdmin } from "@/lib/admin/guard";
import { asArray, asBoolean, asNumber, asString, loadAdminClient } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/workspace/timezone";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  await requireReadyPlatformAdmin("/admin/clientes");
  const { userId } = await params;
  if (!UUID.test(userId)) notFound();

  let row: Record<string, unknown>;
  try {
    row = await loadAdminClient(userId);
  } catch {
    notFound();
  }

  const favorites = asArray(row.favorites);
  const appointments = asArray(row.appointments);
  const held = asBoolean(row.held);
  const name = asString(row.full_name) ?? "Cliente";

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Cliente"
        title={name}
        description={`Cadastrado em ${formatDateTime(asString(row.created_at))}`}
        icon={UsersRound}
        actions={
          <HoldAccountForm
            subjectType="user"
            subjectId={userId}
            held={held}
            name={name}
            returnTo={`/admin/clientes/${userId}`}
          />
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[1.25rem] bg-card p-4 ring-1 ring-primary/10">
          <p className="text-sm text-muted-foreground">E-mail</p>
          <p className="mt-1 font-medium break-all">{asString(row.email)}</p>
        </article>
        <article className="rounded-[1.25rem] bg-card p-4 ring-1 ring-primary/10">
          <p className="text-sm text-muted-foreground">Telefone</p>
          <p className="mt-1 font-medium">{asString(row.phone) ?? "—"}</p>
        </article>
        <article className="rounded-[1.25rem] bg-card p-4 ring-1 ring-primary/10">
          <p className="text-sm text-muted-foreground">Situação</p>
          <div className="mt-1">
            {held ? <StatusBadge value="held" kind="hold" /> : <StatusBadge value={asBoolean(row.email_confirmed) ? "active" : "expired"} />}
          </div>
        </article>
      </section>

      <section className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
        <h2 className="font-medium text-wine-deep">Salões favoritos</h2>
        <div className="mt-4 grid gap-2">
          {favorites.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum favorito.</p>
          ) : favorites.map((favorite) => {
            const workspaceId = asString(favorite.workspace_id);
            return (
              <p key={workspaceId} className="text-sm">
                {workspaceId ? (
                  <Link href={`/admin/estabelecimentos/${workspaceId}`} className="text-wine-deep underline-offset-4 hover:underline">
                    {asString(favorite.name)}
                  </Link>
                ) : asString(favorite.name)}
              </p>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
        <h2 className="font-medium text-wine-deep">Histórico de agendamentos</h2>
        <div className="mt-4 grid gap-2">
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum horário vinculado a esta conta.</p>
          ) : appointments.map((appointment) => (
            <div key={asString(appointment.id)} className="flex flex-wrap justify-between gap-2 text-sm">
              <span>{asString(appointment.workspace_name)} · {asString(appointment.service_name)}</span>
              <span>{appointmentStatusLabel(asString(appointment.status))}</span>
              <span>{formatMoney(asNumber(appointment.price_cents))}</span>
              <span className="text-muted-foreground">{formatDateTime(asString(appointment.starts_at))}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
