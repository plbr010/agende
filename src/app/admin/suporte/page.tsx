import Link from "next/link";
import { LifeBuoy, ScrollText, UserRoundSearch } from "lucide-react";
import { AdminFilters } from "@/components/admin/filters";
import { StatusBadge } from "@/components/admin/status-badge";
import { AdminPager, AdminTable } from "@/components/admin/table";
import { PageHeader } from "@/components/app/page-header";
import { adminActionLabel, formatPlan } from "@/lib/admin/format";
import { requireReadyPlatformAdmin } from "@/lib/admin/guard";
import { clampQuery, optionalFilter, parsePage } from "@/lib/admin/params";
import { asArray, asBoolean, asString, loadAdminAudit, loadAdminSupportOverview, loadAdminUsers } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/workspace/timezone";

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; intent?: string; status?: string; page?: string }>;
}) {
  await requireReadyPlatformAdmin("/admin/suporte");
  const params = await searchParams;
  const query = clampQuery(params.q);
  const intent = optionalFilter(params.intent, ["client", "professional"]);
  const status = optionalFilter(params.status, ["active", "unconfirmed", "held", "admin"]);
  const page = parsePage(params.page);

  let users: Awaited<ReturnType<typeof loadAdminUsers>>;
  let audit: Awaited<ReturnType<typeof loadAdminAudit>>;
  let support: Record<string, unknown>;
  try {
    [users, audit, support] = await Promise.all([
      loadAdminUsers({ query, intent, status, page }),
      loadAdminAudit({ query, page }),
      loadAdminSupportOverview(),
    ]);
  } catch (error) {
    return <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : "Erro ao carregar."}</p>;
  }

  const unconfirmed = asArray(support.unconfirmed_signups);
  const held = asArray(support.held_accounts);
  const pastDue = asArray(support.past_due);
  const privacy = asArray(support.privacy_requests);
  const failed = asArray(support.failed_payments);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Suporte"
        title="Contas, problemas e logs"
        description="Cadastros incompletos, suspensões e o histórico de quem alterou o quê. A plataforma não guarda um log de exceção de aplicação; falhas de cobrança vêm do Stripe já sincronizado."
        icon={LifeBuoy}
      />

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
          <h2 className="font-medium text-wine-deep">Cadastros pendentes</h2>
          <div className="mt-3 grid gap-2">
            {unconfirmed.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum e-mail sem confirmação no recorte recente.</p> : unconfirmed.map((row) => (
              <p key={asString(row.user_id)} className="text-sm">
                {asString(row.email)} · {asBoolean(row.has_profile) ? "com perfil" : "sem perfil"} · {formatDateTime(asString(row.created_at))}
              </p>
            ))}
          </div>
        </article>
        <article className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
          <h2 className="font-medium text-wine-deep">Contas suspensas</h2>
          <div className="mt-3 grid gap-2">
            {held.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma suspensão ativa.</p> : held.map((row) => (
              <p key={asString(row.id)} className="text-sm">
                {asString(row.subject_type)} · {asString(row.reason)} · {formatDateTime(asString(row.created_at))}
              </p>
            ))}
          </div>
        </article>
        <article className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
          <h2 className="font-medium text-wine-deep">Inadimplência</h2>
          <div className="mt-3 grid gap-2">
            {pastDue.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma assinatura past_due.</p> : pastDue.map((row) => (
              <p key={asString(row.workspace_id)} className="text-sm">
                {asString(row.workspace_id) ? (
                  <Link href={`/admin/estabelecimentos/${asString(row.workspace_id)}`} className="text-wine-deep underline-offset-4 hover:underline">
                    {asString(row.workspace_name)}
                  </Link>
                ) : asString(row.workspace_name)}
                {" · "}{formatPlan(asString(row.plan))}
              </p>
            ))}
          </div>
        </article>
        <article className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
          <h2 className="font-medium text-wine-deep">Pagamentos recusados</h2>
          <div className="mt-3 grid gap-2">
            {failed.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum evento recusado no recorte recente.</p> : failed.map((row) => (
              <p key={asString(row.id)} className="text-sm">
                {asString(row.workspace_name)} · {asString(row.event_type)} · {formatDateTime(asString(row.occurred_at))}
              </p>
            ))}
          </div>
        </article>
      </section>

      {privacy.length > 0 ? (
        <section className="rounded-[1.5rem] bg-card p-5 ring-1 ring-primary/10">
          <h2 className="font-medium text-wine-deep">Pedidos de privacidade</h2>
          <div className="mt-3 grid gap-2">
            {privacy.map((row) => (
              <p key={asString(row.id)} className="text-sm">{asString(row.request_type)} · {asString(row.status)} · {formatDateTime(asString(row.created_at))}</p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4">
        <div className="flex items-center gap-2 text-wine-deep">
          <UserRoundSearch className="size-4" />
          <h2 className="font-medium">Usuários</h2>
        </div>
        <AdminFilters
          searchPlaceholder="Buscar nome, e-mail ou telefone"
          selects={[
            { name: "intent", label: "Tipo", options: [{ value: "professional", label: "Profissional" }, { value: "client", label: "Cliente" }] },
            {
              name: "status",
              label: "Situação",
              options: [
                { value: "active", label: "Ativa" },
                { value: "unconfirmed", label: "Não confirmada" },
                { value: "held", label: "Suspensa" },
                { value: "admin", label: "Master admin" },
              ],
            },
          ]}
        />
        <AdminTable
          columns={["Usuário", "Tipo", "Situação", "Cadastro"]}
          isEmpty={users.items.length === 0}
          emptyIcon={UserRoundSearch}
          emptyTitle="Nenhum usuário neste filtro"
          emptyDescription="A busca não expõe senha, token nem metadados internos."
        >
          {users.items.map((row) => {
            const id = asString(row.user_id);
            const href = asString(row.intended_use) === "client" ? `/admin/clientes/${id}` : `/admin/profissionais/${id}`;
            return (
              <tr key={id} className="hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link href={href} className="font-medium text-wine-deep underline-offset-4 hover:underline">{asString(row.full_name)}</Link>
                  <p className="text-xs text-muted-foreground">{asString(row.email)}</p>
                </td>
                <td className="px-4 py-3 text-sm">{asString(row.intended_use) === "client" ? "Cliente" : "Profissional"}</td>
                <td className="px-4 py-3">
                  {asBoolean(row.platform_admin) ? <StatusBadge value="active" /> : asBoolean(row.held) ? <StatusBadge value="held" kind="hold" /> : <StatusBadge value={asBoolean(row.email_confirmed) ? "active" : "expired"} />}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{formatDateTime(asString(row.created_at))}</td>
              </tr>
            );
          })}
        </AdminTable>
        <AdminPager path="/admin/suporte" page={page} total={users.total} params={{ q: query, intent, status }} />
      </section>

      <section className="grid gap-4">
        <div className="flex items-center gap-2 text-wine-deep">
          <ScrollText className="size-4" />
          <h2 className="font-medium">Logs administrativos</h2>
        </div>
        <AdminTable
          columns={["Quando", "Quem", "Ação", "Alvo"]}
          isEmpty={audit.items.length === 0}
          emptyIcon={ScrollText}
          emptyTitle="Nenhuma ação master ainda"
          emptyDescription="Suspensões, reativações e concessões de acesso aparecem aqui."
        >
          {audit.items.map((row) => (
            <tr key={asString(row.id)}>
              <td className="px-4 py-3 text-sm">{formatDateTime(asString(row.created_at))}</td>
              <td className="px-4 py-3 text-sm">{asString(row.actor_name) ?? asString(row.actor_email) ?? "—"}</td>
              <td className="px-4 py-3 text-sm">{adminActionLabel(asString(row.action) ?? "")}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{asString(row.entity_type)} {asString(row.entity_id)}</td>
            </tr>
          ))}
        </AdminTable>
      </section>
    </div>
  );
}
