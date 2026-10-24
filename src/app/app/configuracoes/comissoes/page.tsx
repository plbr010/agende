import { requireActiveWorkspace, requireConfirmedSession } from "@/lib/auth/session";
import { CommissionSettingsForm } from "@/components/commissions/commission-settings-form";
import { commissionSettingsSchema } from "@/lib/commissions/queries";
import { loadServices, loadTeam } from "@/lib/catalog/queries";
import { createClient } from "@/lib/supabase/server";

export default async function CommissionSettingsPage() {
  const session = await requireConfirmedSession("/app/configuracoes/comissoes");
  const workspace = requireActiveWorkspace(session);
  const allowed = session.permissions
    ? Boolean(session.permissions["commissions.manage_team"])
    : workspace.role === "owner" || workspace.role === "admin";
  if (!allowed) {
    return <p className="rounded-3xl bg-secondary/70 px-4 py-6 text-sm">A proprietária configura os percentuais da equipe.</p>;
  }
  const supabase = await createClient();
  const [{ data, error }, team, services] = await Promise.all([
    supabase.rpc("get_commission_settings", { p_workspace_id: workspace.id }),
    loadTeam(workspace.id),
    loadServices(workspace.id),
  ]);
  if (error) {
    return <p className="rounded-3xl bg-secondary/70 px-4 py-6 text-sm">Não foi possível abrir as comissões. Tente de novo.</p>;
  }
  const settings = commissionSettingsSchema.parse(data);
  const professionals = team.filter((member) => member.hasProfessionalProfile && member.status === "active");

  return (
    <CommissionSettingsForm
      settings={settings}
      professionals={professionals.map((member) => ({ id: member.memberId, name: member.displayName ?? member.fullName }))}
      services={services.filter((service) => service.active).map((service) => ({ id: service.id, name: service.name }))}
    />
  );
}
