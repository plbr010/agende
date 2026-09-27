import { requireConfirmedSession } from "@/lib/auth/session";
import { loadSeatUsage, loadSubscriptionDetail, loadWorkspaceSettings } from "@/lib/workspace/queries";
import { SubscriptionOverview } from "@/components/billing/subscription-overview";
import { STRIPE_CAPABILITIES } from "@/lib/billing/stripe-contract";
import { billingAction } from "@/lib/billing/actions";

export default async function SubscriptionSettingsPage({ searchParams }: {
  searchParams: Promise<{ checkout?: string | string[] }>;
}) {
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
  const query = await searchParams;

  return <SubscriptionOverview subscription={subscription} seats={seats} timezone={timezone} capabilities={STRIPE_CAPABILITIES}
    canManage={workspace.role === "owner" || workspace.role === "admin"}
    checkoutReturn={typeof query.checkout === "string" ? query.checkout : undefined} billingAction={billingAction} />;
}
