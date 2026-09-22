import "server-only";

import type { FinanceBackend } from "@/lib/finance/queries";
import type { InventoryBackend } from "@/lib/inventory/queries";
import type { PackagesBackend } from "@/lib/packages/queries";
import type { ReportsBackend } from "@/lib/reports/queries";
import { createClient } from "@/lib/supabase/server";

async function unwrapRpc<T>(
  request: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  rpcName: string,
): Promise<T> {
  const { data, error } = await request;
  if (error) throw new Error(`Supabase RPC ${rpcName} failed: ${error.message}`);
  if (data === null) throw new Error(`Supabase RPC ${rpcName} returned no data`);
  return data;
}

const inventory: InventoryBackend = {
  async loadInventory(workspaceId) {
    const supabase = await createClient();
    return unwrapRpc(supabase.rpc("get_inventory_ui", { p_workspace_id: workspaceId }), "get_inventory_ui");
  },
};

const packages: PackagesBackend = {
  async loadPackages(workspaceId) {
    const supabase = await createClient();
    return unwrapRpc(supabase.rpc("get_packages_ui", { p_workspace_id: workspaceId }), "get_packages_ui");
  },
  async sellPackage(input) {
    const supabase = await createClient();
    return unwrapRpc(supabase.rpc("sell_service_package", {
      p_workspace_id: input.workspaceId,
      p_client_id: input.clientId,
      p_package_id: input.packageId,
    }), "sell_service_package");
  },
  async cancelClientPackage(input) {
    const supabase = await createClient();
    return unwrapRpc(supabase.rpc("cancel_client_package", {
      p_workspace_id: input.workspaceId,
      p_client_package_id: input.clientPackageId,
    }), "cancel_client_package");
  },
  async reversePackageRedemption(input) {
    const supabase = await createClient();
    return unwrapRpc(supabase.rpc("reverse_package_redemption", {
      p_workspace_id: input.workspaceId,
      p_redemption_id: input.redemptionId,
      p_reason: input.reason,
    }), "reverse_package_redemption");
  },
};

const finance: FinanceBackend = {
  async loadFinance(input) {
    const supabase = await createClient();
    return unwrapRpc(supabase.rpc("get_finance_ui", {
      p_workspace_id: input.workspaceId,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
    }), "get_finance_ui");
  },
  async createEntry(input) {
    const supabase = await createClient();
    return unwrapRpc(supabase.rpc("create_financial_entry", {
      p_workspace_id: input.workspaceId,
      p_entry_type: input.kind,
      p_description: input.description,
      p_amount_cents: input.amountCents,
      ...(input.dueDate ? { p_due_date: input.dueDate } : {}),
      ...(input.categoryId ? { p_category_id: input.categoryId } : {}),
      ...(input.idempotencyKey ? { p_idempotency_key: input.idempotencyKey } : {}),
    }), "create_financial_entry");
  },
  async markEntryPaid(input) {
    const supabase = await createClient();
    return unwrapRpc(supabase.rpc("mark_financial_entry_paid", {
      p_workspace_id: input.workspaceId,
      p_entry_id: input.entryId,
      p_payment_method: input.paymentMethod,
      ...(input.paidAt ? { p_paid_at: input.paidAt } : {}),
    }), "mark_financial_entry_paid");
  },
  async cancelEntry(input) {
    const supabase = await createClient();
    return unwrapRpc(supabase.rpc("cancel_financial_entry", {
      p_workspace_id: input.workspaceId,
      p_entry_id: input.entryId,
    }), "cancel_financial_entry");
  },
  async reopenEntry(input) {
    const supabase = await createClient();
    return unwrapRpc(supabase.rpc("reopen_financial_entry", {
      p_workspace_id: input.workspaceId,
      p_entry_id: input.entryId,
    }), "reopen_financial_entry");
  },
  async refundEntry(input) {
    const supabase = await createClient();
    return unwrapRpc(supabase.rpc("refund_financial_entry", {
      p_workspace_id: input.workspaceId,
      p_entry_id: input.entryId,
      p_amount_cents: input.amountCents,
      p_reason: input.reason,
      p_payment_method: input.paymentMethod,
      ...(input.refundedAt ? { p_refunded_at: input.refundedAt } : {}),
      ...(input.idempotencyKey ? { p_idempotency_key: input.idempotencyKey } : {}),
    }), "refund_financial_entry");
  },
};

const reports: ReportsBackend = {
  async loadAdvancedReport(input) {
    const supabase = await createClient();
    return unwrapRpc(supabase.rpc("get_workspace_advanced_report", {
      p_workspace_id: input.workspaceId,
      p_start_date: input.from,
      p_end_date: input.to,
    }), "get_workspace_advanced_report");
  },
};

export const supabaseOperationalAdapters = { inventory, packages, finance, reports };
