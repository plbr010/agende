"use server";

import { requireConfirmedSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createEdgeBillingBackend } from "./edge-adapter";
import { runBillingAction, type BillingActionInput, type BillingActionResult } from "./action-handler";

export async function billingAction(input: BillingActionInput): Promise<BillingActionResult> {
  const session = await requireConfirmedSession("/app/configuracoes/assinatura");
  const supabase = await createClient();
  return runBillingAction(input, session.workspaces[0] ?? null,
    createEdgeBillingBackend((name, options) => supabase.functions.invoke(name, options)));
}
