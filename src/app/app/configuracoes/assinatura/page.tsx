import { requireConfirmedSession } from "@/lib/auth/session";
import { loadSeatUsage, loadSubscriptionDetail, loadWorkspaceSettings } from "@/lib/workspace/queries";
import { SubscriptionOverview } from "@/components/billing/subscription-overview";
import { STRIPE_CAPABILITIES } from "@/lib/billing/stripe-contract";

export default async function SubscriptionSettingsPage() {
  const session = await requireConfirmedSession("/app/configuracoes/assinatura");
  const workspace = session.workspaces[0];
  if (!workspace) {
    return null;
  }
  const [subscription, seats, settings] = await Promise.all([
    loadSubscriptionDetail(workspace.id),
    loadSeatUsage(workspace.id),
    loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug),
  ]);
  const timezone = settings.timezone;

  return <SubscriptionOverview subscription={subscription} seats={seats} timezone={timezone} capabilities={STRIPE_CAPABILITIES} />;
}
