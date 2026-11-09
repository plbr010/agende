"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireConfirmedSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ACQUISITION_COOKIE } from "@/lib/marketing/meta-pixel";
import { RASTREIO_VISITOR_COOKIE, checkoutAttribution } from "@/lib/marketing/rastreio";
import { createEdgeBillingBackend, createEdgeManageBackend } from "./edge-adapter";
import { runBillingAction, type BillingActionInput, type BillingActionResult } from "./action-handler";
import { runManageAction, type ManageActionInput, type ManageActionResult } from "./manage";

const SUBSCRIPTION_PATH = "/app/configuracoes/assinatura";

export async function billingAction(input: BillingActionInput): Promise<BillingActionResult> {
  const session = await requireConfirmedSession(SUBSCRIPTION_PATH);
  const supabase = await createClient();
  const cookieStore = await cookies();
  const attribution = checkoutAttribution({
    visitor: cookieStore.get(RASTREIO_VISITOR_COOKIE)?.value,
    acquisition: cookieStore.get(ACQUISITION_COOKIE)?.value,
  });
  return runBillingAction(input, session.workspaces[0] ?? null,
    createEdgeBillingBackend((name, options) => supabase.functions.invoke(name, options)), attribution);
}

export async function manageSubscriptionAction(input: ManageActionInput): Promise<ManageActionResult> {
  const session = await requireConfirmedSession(SUBSCRIPTION_PATH);
  const supabase = await createClient();
  const result = await runManageAction(input, session.workspaces[0] ?? null,
    createEdgeManageBackend((name, options) => supabase.functions.invoke(name, options)));
  if (result.ok && input.action !== "preview_annual") revalidatePath(SUBSCRIPTION_PATH);
  return result;
}
