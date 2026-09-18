"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelMyAppointmentAction } from "@/lib/booking/actions";
import { CLIENT_CANCEL_LEAD_MINUTES } from "@/lib/booking/config";
import type { MyAppointment } from "@/lib/booking/queries";
import { canClientCancel, partitionClientAppointments } from "@/lib/booking/validation";
import { STATUS_LABEL, type AppointmentStatus, isAppointmentStatus } from "@/lib/agenda/status";
import { formatDateTimeInTimeZone } from "@/lib/time/timezone";
import { formatCentsToReais } from "@/lib/validation/money";

export function ClientAppointments({ initial }: { initial: MyAppointment[] }) {
  const [items, setItems] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { upcoming, past } = partitionClientAppointments(items);

  function cancel(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await cancelMyAppointmentAction(id);
      if (result.error) {
        setMessage(result.error);
      } else {
        setItems((current) =>
          current.map((item) => (item.id === id ? { ...item, status: "cancelled" } : item)),
        );
        setMessage(result.success ?? "Cancelado.");
      }
      setPendingId(null);
    });
  }

  return (
    <div className="grid gap-8">
      {message ? <p className="text-sm text-muted-foreground" role="status">{message}</p> : null}
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Próximos</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum horário à frente.</p>
        ) : (
          upcoming.map((item) => (
            <AppointmentCard
              key={item.id}
              item={item}
              pending={pending && pendingId === item.id}
              onCancel={() => cancel(item.id)}
            />
          ))
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Anteriores</h2>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
        ) : (
          past.map((item) => (
            <AppointmentCard key={item.id} item={item} pending={false} />
          ))
        )}
      </section>
    </div>
  );
}

function AppointmentCard({
  item,
  pending,
  onCancel,
}: {
  item: MyAppointment;
  pending: boolean;
  onCancel?: () => void;
}) {
  const status = (isAppointmentStatus(item.status) ? item.status : "scheduled") as AppointmentStatus;
  const cancellable = onCancel ? canClientCancel(item.status, item.startsAt, CLIENT_CANCEL_LEAD_MINUTES) : { ok: false as const, reason: "terminal" as const };

  return (
    <article className="rounded-3xl bg-card p-5 ring-1 ring-border">
      <p className="text-xs tracking-[0.18em] text-primary uppercase">{item.workspaceName}</p>
      <h3 className="mt-1 font-serif text-2xl">{item.serviceName}</h3>
      <p className="text-sm text-muted-foreground">{item.professionalName}</p>
      <p className="mt-3 text-sm">{formatDateTimeInTimeZone(item.startsAt, item.timezone)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary px-3 py-1 text-xs">{STATUS_LABEL[status]}</span>
        <span className="text-sm">{formatCentsToReais(item.priceCents)}</span>
      </div>
      {cancellable.ok && onCancel ? (
        <Button
          type="button"
          variant="outline"
          className="mt-4 h-11 rounded-full"
          disabled={pending}
          onClick={onCancel}
        >
          {pending ? "Cancelando…" : "Cancelar"}
        </Button>
      ) : null}
      <p className="mt-3 text-sm">
        <Link href={`/p/${item.slug}`} className="underline underline-offset-4">
          Ver estabelecimento
        </Link>
      </p>
    </article>
  );
}
