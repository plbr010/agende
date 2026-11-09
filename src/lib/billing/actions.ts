"use server";

import { cookies } from "next/headers";
import { requireConfirmedSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ACQUISITION_COOKIE } from "@/lib/marketing/meta-pixel";
import { RASTREIO_VISITOR_COOKIE, checkoutAttribution } from "@/lib/marketing/rastreio";
import { createEdgeBillingBackend } from "./edge-adapter";
import { runBillingAction, type BillingActionInput, type BillingActionResult } from "./action-handler";

export async function billingAction(input: BillingActionInput): Promise<BillingActionResult> {
  const session = await requireConfirmedSession("/app/configuracoes/assinatura");
  const supabase = await createClient();
  const cookieStore = await cookies();
  const attribution = checkoutAttribution({
    visitor: cookieStore.get(RASTREIO_VISITOR_COOKIE)?.value,
    acquisition: cookieStore.get(ACQUISITION_COOKIE)?.value,
  });
  return runBillingAction(input, session.workspaces[0] ?? null,
    createEdgeBillingBackend((name, options) => supabase.functions.invoke(name, options)), attribution);
}
