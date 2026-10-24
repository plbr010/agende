"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustCommissionAction, payCommissionAction } from "@/lib/commissions/actions";
import { commissionStatusLabel, formatRate, type CommissionsUi } from "@/lib/commissions/queries";
import { formatCentsToReais } from "@/lib/validation/money";

const eventLabel: Record<string, string> = {
  calculated: "Calculada",
  money_sync: "Recebimento ou estorno",
  adjustment: "Ajuste",
  payment: "Pagamento",
  recovery: "Devolução",
  beneficiary_changed: "Troca de profissional",
};

async function run(action: (formData: FormData) => Promise<{ error?: string; success?: string }>, formData: FormData) {
  const result = await action(formData);
  if (result.error) toast.error(result.error);
  else if (result.success) toast.success(result.success);
}

export function CommissionsBoard({
  data,
  canPay,
  canAdjust,
}: {
  data: CommissionsUi;
  canPay: boolean;
  canAdjust: boolean;
}) {
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [payKeys, setPayKeys] = useState<Record<string, string>>({});
  const groups = [
    { status: "released" as const, title: "Liberadas para pagar" },
    { status: "pending" as const, title: "Aguardando" },
    { status: "adjusted" as const, title: "Ajustadas" },
    { status: "paid" as const, title: "Pagas" },
  ];

  return (
    <div className="grid gap-6">
      {data.viewer === "own" ? (
        <p className="text-sm text-muted-foreground">Aqui aparecem só as suas comissões.</p>
      ) : null}
      {groups.map((group) => {
        const entries = data.entries.filter((entry) => entry.status === group.status);
        if (entries.length === 0) return null;
        return (
          <section key={group.status} className="grid gap-3">
            <h2 className="font-serif text-2xl text-wine-deep">{group.title}</h2>
            {entries.map((entry) => {
              const open = openId === entry.id;
              const owed = Math.max(entry.released_cents - entry.paid_cents, 0);
              const recoverable = Math.max(entry.paid_cents - entry.current_cents, 0);
              return (
                <article key={entry.id} className="agende-shadow grid gap-3 rounded-3xl border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{entry.professional_name}</h3>
                      <p className="text-sm text-muted-foreground">{entry.service_name} · {entry.client_name} · {formatRate(entry.rate_bps)}</p>
                    </div>
                    <div className="text-right">
                      <strong>{formatCentsToReais(entry.current_cents)}</strong>
                      <p className="text-sm">{commissionStatusLabel[entry.status]}</p>
                    </div>
                  </div>
                  <p className="text-sm">Liberado {formatCentsToReais(entry.released_cents)} · Pago {formatCentsToReais(entry.paid_cents)}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-fit"
                    onClick={() => {
                      setOpenId(open ? null : entry.id);
                      setPayKeys((current) => current[entry.id] ? current : { ...current, [entry.id]: crypto.randomUUID() });
                    }}
                  >
                    {open ? "Fechar histórico" : "Ver histórico"}
                  </Button>
                  {open ? (
                    <div className="grid gap-4">
                      <ul className="grid gap-2 text-sm">
                        {entry.events.map((event) => (
                          <li key={event.id} className="rounded-2xl bg-secondary/60 px-3 py-2">
                            {eventLabel[event.event_type] ?? "Registro"} · {formatCentsToReais(event.current_cents)}
                            {event.note ? ` · ${event.note}` : ""}
                          </li>
                        ))}
                        {entry.payments.map((payment) => (
                          <li key={payment.id} className="rounded-2xl bg-secondary/60 px-3 py-2">
                            {payment.direction === "payout" ? "Pagamento" : "Devolução"} de {formatCentsToReais(payment.amount_cents)} em {payment.paid_on.split("-").reverse().join("/")}
                            {payment.note ? ` · ${payment.note}` : ""}
                          </li>
                        ))}
                      </ul>
                      {canPay && (owed > 0 || recoverable > 0) ? (
                        <form className="grid gap-3 sm:grid-cols-2" action={(formData) => start(async () => {
                          const result = await payCommissionAction(formData);
                          if (result.error) toast.error(result.error);
                          else if (result.success) {
                            toast.success(result.success);
                            setPayKeys((current) => ({ ...current, [entry.id]: crypto.randomUUID() }));
                          }
                        })}>
                          <input type="hidden" name="commissionId" value={entry.id} />
                          <input type="hidden" name="direction" value={recoverable > 0 ? "recovery" : "payout"} />
                          <input type="hidden" name="idempotencyKey" value={payKeys[entry.id] ?? ""} />
                          <div className="grid gap-2">
                            <Label htmlFor={`pay-${entry.id}`}>{recoverable > 0 ? "Valor devolvido (R$)" : "Valor pago (R$)"}</Label>
                            <Input id={`pay-${entry.id}`} name="amount" inputMode="decimal" placeholder="0,00" required />
                            <p className="text-sm text-muted-foreground">Até {formatCentsToReais(recoverable > 0 ? recoverable : owed)}. Registre somente dinheiro efetivamente {recoverable > 0 ? "devolvido" : "pago"}; o caixa será atualizado.</p>
                            <p className="text-sm text-muted-foreground">A forma de pagamento fica como “Outro”. Informe detalhes na observação.</p>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor={`date-${entry.id}`}>Data</Label>
                            <Input id={`date-${entry.id}`} name="paidOn" type="date" required />
                          </div>
                          <div className="grid gap-2 sm:col-span-2">
                            <Label htmlFor={`note-${entry.id}`}>Observação</Label>
                            <Input id={`note-${entry.id}`} name="note" maxLength={200} minLength={recoverable > 0 ? 3 : undefined} required={recoverable > 0} />
                          </div>
                          <Button type="submit" className="h-11 sm:col-span-2" disabled={pending}>{recoverable > 0 ? "Registrar devolução recebida" : "Registrar pagamento"}</Button>
                        </form>
                      ) : null}
                      {canAdjust ? (
                        <form className="grid gap-3" action={(formData) => {
                          if (!window.confirm("Este ajuste fica no histórico e não apaga o valor original. Continuar?")) return;
                          start(() => void run(adjustCommissionAction, formData));
                        }}>
                          <input type="hidden" name="commissionId" value={entry.id} />
                          <Label htmlFor={`adjust-${entry.id}`}>Novo valor da comissão (R$)</Label>
                          <Input id={`adjust-${entry.id}`} name="amount" inputMode="decimal" required />
                          <Label htmlFor={`reason-${entry.id}`}>Motivo</Label>
                          <Input id={`reason-${entry.id}`} name="reason" required minLength={3} />
                          <Button type="submit" variant="outline" className="h-11" disabled={pending}>Ajustar comissão</Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </section>
        );
      })}
      {data.entries.length === 0 ? (
        <p className="rounded-3xl bg-secondary/70 px-4 py-6 text-sm">Nenhuma comissão por aqui ainda.</p>
      ) : null}
    </div>
  );
}
