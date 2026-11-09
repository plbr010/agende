import { requireActiveWorkspace, requireConfirmedSession } from "@/lib/auth/session";
import { loadSeatUsage, loadSubscriptionDetail, loadWorkspaceSettings } from "@/lib/workspace/queries";
import { SubscriptionOverview } from "@/components/billing/subscription-overview";
import { STRIPE_CAPABILITIES } from "@/lib/billing/stripe-contract";
import { billingAction } from "@/lib/billing/actions";
import { PixelEvent } from "@/components/marketing/meta-pixel";
import { PLANS } from "@/lib/marketing/content";
import { getSelectedInterval } from "@/lib/auth/actions";

export default async function SubscriptionSettingsPage({ searchParams }: {
  searchParams: Promise<{ checkout?: string | string[] }>;
}) {
  const session = await requireConfirmedSession("/app/configuracoes/assinatura");
  const workspace = requireActiveWorkspace(session);
  const [subscription, seats, settings, preferredInterval] = await Promise.all([
    loadSubscriptionDetail(workspace.id),
    loadSeatUsage(workspace.id),
    loadWorkspaceSettings(workspace.id, workspace.name, workspace.slug),
    getSelectedInterval(),
  ]);
  const timezone = settings.timezone;
  const query = await searchParams;

  const checkoutReturn = typeof query.checkout === "string" ? query.checkout : undefined;
  // Checkout completed: the card is on file; Stripe charges when the trial ends.
  const plan = PLANS.find((item) => item.id === subscription?.plan);
  const subscribeValue = plan ? (subscription?.billingInterval === "annual" ? plan.annualPriceCents : plan.priceCents) / 100 : undefined;

  return <>
    {checkoutReturn === "success" ? <PixelEvent event="Subscribe" onceKey={workspace.id} value={subscribeValue} /> : null}
    <SubscriptionOverview subscription={subscription} seats={seats} timezone={timezone} capabilities={STRIPE_CAPABILITIES}
      canManage={workspace.role === "owner" || workspace.role === "admin"} preferredInterval={preferredInterval}
      checkoutReturn={checkoutReturn} billingAction={billingAction} />
  </>;
}
