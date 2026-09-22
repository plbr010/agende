"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CalendarCheck2, CalendarDays, Clock3, ExternalLink, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      {message ? <p className="rounded-2xl bg-secondary/70 px-4 py-3 text-sm text-muted-foreground" role="status">{message}</p> : null}
      <section className="grid gap-3">
        <div className="flex items-center gap-2"><CalendarDays className="size-4 text-primary" /><h2 className="font-serif text-2xl">Próximos</h2></div>
        {upcoming.length === 0 ? (
          <EmptyAppointments icon={CalendarDays} title="Nenhum horário à frente" description="Quando você fizer uma reserva, os detalhes aparecem aqui." />
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
        <div className="flex items-center gap-2"><Clock3 className="size-4 text-primary" /><h2 className="font-serif text-2xl">Anteriores</h2></div>
        {past.length === 0 ? (
          <EmptyAppointments icon={Clock3} title="Seu histórico está vazio" description="Atendimentos concluídos e cancelados ficam organizados aqui." />
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
    <article className="group rounded-3xl border border-border/70 bg-card/85 p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
          {status === "completed" ? <CalendarCheck2 className="size-5" /> : <CalendarDays className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">{item.workspaceName}</p>
          <h3 className="mt-1 font-serif text-2xl">{item.serviceName}</h3>
          <p className="text-sm text-muted-foreground">com {item.professionalName}</p>
          <p className="mt-3 text-sm font-medium">{formatDateTimeInTimeZone(item.startsAt, item.timezone)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs">{STATUS_LABEL[status]}</span>
            <span className="text-sm text-muted-foreground">{formatCentsToReais(item.priceCents)}</span>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
        {cancellable.ok && onCancel ? (
          <Button type="button" variant="outline" className="h-10 rounded-full" disabled={pending} onClick={onCancel}>
            {pending ? "Cancelando…" : "Cancelar horário"}
          </Button>
        ) : null}
        {status === "completed" ? (
          <Button variant="outline" className="h-10 rounded-full" render={<Link href="/cliente/avaliacoes" />}><Star className="size-4" /> Preparar avaliação</Button>
        ) : null}
        <Link href={`/p/${item.slug}`} className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline">
          Ver estabelecimento <ExternalLink className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}

function EmptyAppointments({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CalendarDays;
  title: string;
  description: string;
}) {
  return (
    <Card className="rounded-3xl border-dashed border-border/80 bg-card/55 shadow-none">
      <CardContent className="flex items-center gap-4 py-7">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><Icon className="size-4" /></div>
        <div><p className="font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
      </CardContent>
    </Card>
  );
}
