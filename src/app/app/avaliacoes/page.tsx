import { Star } from "lucide-react";
import { requireConfirmedSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/app/page-header";
import { loadReviews } from "@/lib/reviews/queries";
import { loadWorkspaceSettings } from "@/lib/workspace/queries";
import { formatDateTimeInTimeZone } from "@/lib/time/timezone";
export default async function ReviewsPage() {
  const session = await requireConfirmedSession("/app/avaliacoes");
  const workspace = session.workspaces[0];
  if (!workspace) return null;
  const [reviews, settings] = await Promise.all([loadReviews(workspace.id), loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug)]);
  const average = reviews.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : "—";
  return <><PageHeader eyebrow="Sua equipe" title="Avaliações" description="Opiniões de clientes sobre atendimentos concluídos." icon={Star} />
    <p>Nota média: {average} · {reviews.length} avaliações</p>
    <section className="grid gap-4">{reviews.length === 0 ? <p>Nenhuma avaliação recebida.</p> : reviews.map(r => <article key={r.appointment_id} className="rounded-xl border p-4"><p>{r.rating}/5 estrelas</p><p>{r.comment}</p><p className="text-sm text-muted-foreground">{formatDateTimeInTimeZone(r.created_at, settings.timezone)}</p></article>)}</section>
  </>;
}
