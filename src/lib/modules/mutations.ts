import { z } from "zod";
import { parseReaisToCents } from "@/lib/validation/money";
import { planSchema } from "@/lib/billing/plans";
import { paymentMethodSchema } from "@/lib/finance/queries";
import { inactiveWorkspaceMessage } from "@/lib/workspace/settings-errors";
const id = z.string().uuid();
const amount = z.string().transform(parseReaisToCents).pipe(z.number().int().nonnegative());
const quantity = z.string().trim().min(1).transform(Number).pipe(z.number().min(0).max(999999999.999));
// Match inventory_products constraints: accepting wider input here only fails at commit.
const product = {
    name: z.string().trim().min(2, "Informe um nome com 2 a 80 caracteres.").max(80, "O nome pode ter até 80 caracteres."),
    description: z.string().trim().max(500, "A descrição pode ter até 500 caracteres."),
    sku: z.string().trim().max(40, "O código pode ter até 40 caracteres.").refine(value => value === "" || /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value), "Use letras, números, ponto, hífen ou sublinhado no código, começando por letra ou número."),
    unit: z.enum(["unidade", "ml", "g"]), minimum: quantity,
    cost: z.union([z.literal("").transform(() => null), amount.pipe(z.number().max(10000000, "O custo máximo por unidade é R$ 100.000,00."))]),
};
export const mutationSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("trial"), plan: planSchema }),
    z.object({ action: z.literal("product-create"), ...product, quantity }),
    z.object({ action: z.literal("product-update"), ...product, id, active: z.enum(["true", "false"]).transform(v => v === "true") }),
    z.object({ action: z.literal("product-archive"), id }),
    z.object({ action: z.literal("product-reactivate"), id }),
    z.object({ action: z.literal("movement"), id, type: z.enum(["entry", "exit", "adjustment"]), quantity, reason: z.string().trim().min(3).max(500) }).refine(v => v.type === "adjustment" || v.quantity > 0, "Informe uma quantidade maior que zero."),
    z.object({ action: z.literal("package-create"), name: z.string().trim().min(2).max(120), description: z.string().max(2000), amount, validity: z.string().transform(v => v ? Number(v) : null).pipe(z.number().int().min(1).max(3650).nullable()), items: z.array(z.object({ service_id: id, quantity: z.coerce.number().int().min(1).max(100) })).min(1) }),
    z.object({ action: z.literal("package-sell"), id, client: id }),
    z.object({ action: z.literal("package-cancel"), id }),
    z.object({ action: z.literal("finance-create"), kind: z.enum(["income", "expense"]), description: z.string().trim().min(1).max(160), amount: amount.refine(v => v > 0), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), category: z.union([id, z.literal("")]), key: id }),
    z.object({ action: z.literal("finance-paid"), id, method: paymentMethodSchema }),
    z.object({ action: z.literal("finance-cancel"), id }),
    z.object({ action: z.literal("finance-reopen"), id }),
    z.object({ action: z.literal("finance-refund"), id, amount: amount.refine(v => v > 0), reason: z.string().trim().min(3).max(500), method: paymentMethodSchema, key: id, confirmed: z.literal("on") }),
]);
export type Mutation = z.infer<typeof mutationSchema>;
export function parseMutation(form: FormData) {
    const values: Record<string, unknown> = Object.fromEntries(form);
    if (values.action === "package-create")
        values.items = form.getAll("service").map(service => ({ service_id: service, quantity: form.get("sessions-" + service) }));
    return mutationSchema.safeParse(values);
}
export function mutationPath(action: Mutation["action"]) {
    if (action === "trial")
        return "/app/configuracoes/assinatura";
    if (action.startsWith("package-"))
        return "/app/pacotes";
    if (action.startsWith("finance-"))
        return "/app/financeiro";
    return "/app/estoque";
}
export function mutationError(message: string) {
    const errors: Record<string, string> = {
        workspace_subscription_inactive: inactiveWorkspaceMessage,
        inventory_products_workspace_sku_lower_idx: "Este código já está em uso no seu estabelecimento. Escolha outro.",
        plan_professional_limit_reached: "Sua equipe excede o limite deste plano. Reduza os profissionais ativos antes de trocar.",
        trial_not_active: "A troca de plano está disponível apenas durante o teste.",
        workspace_subscription_required: "Seu negócio precisa de uma assinatura válida para continuar.",
        not_authorized: "Você não tem permissão para esta ação.",
        insufficient_stock: "Não há estoque suficiente para esta saída.",
        inventory_product_archived: "Reative o produto antes de movimentar o estoque.",
        client_package_not_active: "Este pacote não está ativo para cancelamento.",
        financial_entry_not_pending: "Somente lançamentos pendentes podem receber baixa.",
        refund_exceeds: "O valor excede o saldo disponível para devolução.",
        idempotency_key_conflict: "Esta solicitação já foi enviada com outros valores. Atualize a página.",
    };
    return Object.entries(errors).find(([key]) => message.includes(key))?.[1] ?? "Não foi possível concluir. Atualize a página e confira os dados e a situação do item.";
}
