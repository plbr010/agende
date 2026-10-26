import { formatCentsToReais } from "@/lib/validation/money";

export function checkoutMessage(summary: {
  repeated: boolean;
  amount_due_cents: number;
  product_total_cents: number;
  received_cents: number;
  commission: { original_cents: number; status: string } | null;
}): string {
  if (summary.repeated) return "Este atendimento já estava concluído. Nada foi lançado de novo.";
  const total = summary.amount_due_cents + summary.product_total_cents;
  const statuses: Record<string, string> = { pending: "aguardando o recebimento", released: "liberada para pagamento", paid: "paga", adjusted: "ajustada" };
  const commission = summary.commission
    ? ` Comissão de ${formatCentsToReais(summary.commission.original_cents)}, ${statuses[summary.commission.status] ?? "registrada"}.`
    : "";
  return `Atendimento concluído. Total ${formatCentsToReais(total)}. Recebido ${formatCentsToReais(summary.received_cents)}. Pendente ${formatCentsToReais(Math.max(total - summary.received_cents, 0))}.${commission}`;
}
