import { CircleDollarSign } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { CommissionsBoard } from "@/components/commissions/commissions-board";
import { requireActiveWorkspace, requireConfirmedSession } from "@/lib/auth/session";
import { commissionsUiSchema } from "@/lib/commissions/queries";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { z } from "zod";

export default async function CommissionsPage({ searchParams }: {
  searchParams: Promise<{ before?: string; beforeId?: string }>;
}) {
  const session = await requireConfirmedSession("/app/comissoes");
  const workspace = requireActiveWorkspace(session);
  const supabase = await createClient();
  const params = await searchParams;
  const validCursor = z.string().datetime({ offset: true }).safeParse(params.before).success
    && z.string().uuid().safeParse(params.beforeId).success;
  const { data, error } = await supabase.rpc("get_commissions_page", {
    p_workspace_id: workspace.id,
    p_before: validCursor ? params.before : null,
    p_before_id: validCursor ? params.beforeId : null,
    p_limit: 50,
  });
  if (error) {
    return (
      <>
        <PageHeader eyebrow="Equipe" title="Comissões" description="O que já foi liberado e o que ainda aguarda o pagamento da cliente." icon={CircleDollarSign} />
        <p className="rounded-3xl bg-secondary/70 px-4 py-6 text-sm">As comissões ainda não estão disponíveis neste salão.</p>
      </>
    );
  }
  const parsed = commissionsUiSchema.safeParse(data);
  if (!parsed.success) {
    return (
      <>
        <PageHeader eyebrow="Equipe" title="Comissões" description="O que já foi liberado e o que ainda aguarda o pagamento da cliente." icon={CircleDollarSign} />
        <p className="rounded-3xl bg-secondary/70 px-4 py-6 text-sm">Não foi possível mostrar as comissões. Tente de novo.</p>
      </>
    );
  }
  const canPay = session.permissions
    ? Boolean(session.permissions["commissions.pay"])
    : workspace.role === "owner" || workspace.role === "admin";
  const canAdjust = session.permissions
    ? Boolean(session.permissions["commissions.manage_team"])
    : workspace.role === "owner" || workspace.role === "admin";
  const hasMore = parsed.data.entries.length > 50;
  const entries = parsed.data.entries.slice(0, 50);
  const last = entries.at(-1);

  return (
    <>
      <PageHeader
        eyebrow="Equipe"
        title="Comissões"
        description={parsed.data.viewer === "team" ? "Veja o que a equipe tem a receber e registre os pagamentos." : "Veja o que você tem a receber."}
        icon={CircleDollarSign}
      />
      <CommissionsBoard data={{ ...parsed.data, entries }} canPay={canPay} canAdjust={canAdjust} />
      <nav aria-label="Páginas de comissões" className="flex gap-4 py-4">
        {validCursor ? <Link href="/app/comissoes">Voltar às mais recentes</Link> : null}
        {hasMore && last ? <Link href={`/app/comissoes?before=${encodeURIComponent(last.created_at)}&beforeId=${last.id}`}>Ver comissões anteriores</Link> : null}
      </nav>
    </>
  );
}
