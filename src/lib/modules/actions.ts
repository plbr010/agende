"use server";
import { revalidatePath } from "next/cache";
import { requireConfirmedSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseMutation, mutationError, mutationPath } from "./mutations";
import type { ActionState } from "@/lib/auth/actions";
export async function managementAction(_previous: ActionState, form: FormData): Promise<ActionState> {
    const parsed = parseMutation(form);
    if (!parsed.success)
        return { error: "Revise os campos. Informe valores válidos e preencha os campos obrigatórios." };
    const v = parsed.data;
    const path = mutationPath(v.action);
    const session = await requireConfirmedSession(path);
    const workspace = session.workspaces[0];
    if (!workspace || !["owner", "admin"].includes(workspace.role))
        return { error: "Você não tem permissão para esta ação." };
    const db = await createClient();
    const w = { p_workspace_id: workspace.id };
    let result;
    try {
        switch (v.action) {
            case "trial":
                result = await db.rpc("change_trial_plan", { ...w, p_plan: v.plan });
                break;
            case "product-create":
                result = await db.rpc("create_inventory_product", { ...w, p_name: v.name, p_description: v.description, p_sku: v.sku, p_unit: v.unit, p_minimum_quantity: v.minimum, p_cost_cents: v.cost, p_initial_quantity: v.quantity });
                break;
            case "product-update":
                result = await db.rpc("update_inventory_product", { ...w, p_product_id: v.id, p_name: v.name, p_description: v.description, p_sku: v.sku, p_unit: v.unit, p_minimum_quantity: v.minimum, p_cost_cents: v.cost, p_active: v.active });
                break;
            case "product-archive":
                result = await db.rpc("archive_inventory_product", { ...w, p_product_id: v.id });
                break;
            case "product-reactivate":
                result = await db.rpc("reactivate_inventory_product", { ...w, p_product_id: v.id });
                break;
            case "movement":
                result = await db.rpc("apply_inventory_movement", { ...w, p_product_id: v.id, p_type: v.type, ...(v.type === "adjustment" ? { p_new_quantity: v.quantity } : { p_quantity: v.quantity }), p_reason: v.reason });
                break;
            case "package-create":
                result = await db.rpc("create_service_package", { ...w, p_name: v.name, p_description: v.description, p_price_cents: v.amount, p_validity_days: v.validity, p_items: v.items });
                break;
            case "package-sell":
                result = await db.rpc("sell_service_package", { ...w, p_package_id: v.id, p_client_id: v.client });
                break;
            case "package-cancel":
                result = await db.rpc("cancel_client_package", { ...w, p_client_package_id: v.id });
                break;
            case "finance-create":
                result = await db.rpc("create_financial_entry", { ...w, p_description: v.description, p_entry_type: v.kind, p_amount_cents: v.amount, p_due_date: v.due, ...(v.category ? { p_category_id: v.category } : {}), p_idempotency_key: v.key });
                break;
            case "finance-paid":
                result = await db.rpc("mark_financial_entry_paid", { ...w, p_entry_id: v.id, p_payment_method: v.method });
                break;
            case "finance-cancel":
                result = await db.rpc("cancel_financial_entry", { ...w, p_entry_id: v.id });
                break;
            case "finance-reopen":
                result = await db.rpc("reopen_financial_entry", { ...w, p_entry_id: v.id });
                break;
            case "finance-refund":
                result = await db.rpc("refund_financial_entry", { ...w, p_entry_id: v.id, p_amount_cents: v.amount, p_reason: v.reason, p_payment_method: v.method, p_idempotency_key: v.key });
                break;
        }
    }
    catch {
        return { error: "Não foi possível conectar. Tente novamente em instantes." };
    }
    if (result.error)
        return { error: mutationError(result.error.message) };
    for (const page of [path, "/app", "/app/financeiro", "/app/pacotes", "/app/relatorios"])
        revalidatePath(page);
    return { success: "Alteração salva." };
}
