import { requireActiveWorkspace, requireConfirmedSession } from "@/lib/auth/session";
import { loadSeatUsage, loadSubscriptionDetail, loadWorkspaceSettings } from "@/lib/workspace/queries";
import { SubscriptionOverview } from "@/components/billing/subscription-overview";
import { STRIPE_CAPABILITIES } from "@/lib/billing/stripe-contract";
import { billingAction, manageSubscriptionAction } from "@/lib/billing/actions";
import { loadSubscriptionState } from "@/lib/billing/manage";
import { createEdgeManageBackend } from "@/lib/billing/edge-adapter";
import { createClient } from "@/lib/supabase/server";
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
  const canManage = workspace.role === "owner" || workspace.role === "admin";
  // Live Stripe state (cancel scheduled, interval) only for managers with a Stripe subscription.
  const supabase = await createClient();
  const manageState = canManage && subscription?.hasStripeSubscription
    ? await loadSubscriptionState(workspace.id, createEdgeManageBackend((name, options) => supabase.functions.invoke(name, options)))
    : null;
  const query = await searchParams;

  const checkoutReturn = typeof query.checkout === "string" ? query.checkout : undefined;
  // Checkout completed: the card is on file; Stripe charges when the trial ends.
  const plan = PLANS.find((item) => item.id === subscription?.plan);
  const subscribeValue = plan ? (subscription?.billingInterval === "annual" ? plan.annualPriceCents : plan.priceCents) / 100 : undefined;

  return <>
    {checkoutReturn === "success" ? <PixelEvent event="Subscribe" onceKey={workspace.id} value={subscribeValue} /> : null}
    <SubscriptionOverview subscription={subscription} seats={seats} timezone={timezone} capabilities={STRIPE_CAPABILITIES}
      canManage={canManage} preferredInterval={preferredInterval}
      manageState={manageState} manageAction={manageSubscriptionAction}
      checkoutReturn={checkoutReturn} billingAction={billingAction} />
  </>;
}
