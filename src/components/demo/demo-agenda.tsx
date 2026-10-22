"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck2, CalendarDays, CircleDollarSign, Clock3 } from "lucide-react";
import { MetricCard } from "@/components/app/metric-card";
import { PageHeader } from "@/components/app/page-header";
import { PersonMark } from "@/components/people/person-mark";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useDemo } from "@/components/demo/demo-provider";
import { APPOINTMENT_STATUSES, STATUS_LABEL, canTransitionStatus, type AppointmentStatus } from "@/lib/agenda/status";
import { STATUS_CHIP_CLASS } from "@/lib/agenda/status-style";
import { DEMO_PROFESSIONALS, type DemoAppointment } from "@/lib/demo/catalog";
import { DEMO_BOOK_HREF } from "@/lib/demo/paths";
import { addDaysIso, weekdayInTimeZone, zonedWallTimeToUtc } from "@/lib/time/timezone";
import { formatCentsToReais } from "@/lib/validation/money";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function weekStart(date: string): string {
  const weekday = weekdayInTimeZone(zonedWallTimeToUtc(date, "12:00", "America/Sao_Paulo"), "America/Sao_Paulo");
  return addDaysIso(date, -weekday);
}

export function DemoAgenda() {
  const demo = useDemo();
  const router = useRouter();
  const params = useSearchParams();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? params.get("date")! : demo.today;
  const view = params.get("view") === "week" ? "week" : "day";
  const professional = DEMO_PROFESSIONALS.some((person) => person.id === params.get("professional")) ? params.get("professional")! : "";
  const requestedHighlight = params.get("destaque");
  const highlightId = requestedHighlight ?? demo.session.highlightId;
  const from = view === "week" ? weekStart(date) : date;
  const days = view === "week" ? Array.from({ length: 7 }, (_, index) => addDaysIso(from, index)) : [date];
  const visible = demo.appointments.filter((item) => days.includes(item.localDate) && (!professional || item.professionalMemberId === professional));
  const active = visible.filter((item) => item.status !== "cancelled" && item.status !== "no_show");
  const highlighted = demo.appointments.find((item) => item.id === highlightId) ?? null;
  const [openId, setOpenId] = useState<string | null>(null);
  const open = demo.appointments.find((item) => item.id === openId) ?? null;

  useEffect(() => {
    if (!highlightId) return;
    document.getElementById(`demo-appt-${highlightId}`)?.scrollIntoView({ block: "center" });
  }, [highlightId, date, view, demo.ready]);

  function href(next: { view?: string; date?: string; professional?: string }) {
    const query = new URLSearchParams({ view: next.view ?? view, date: next.date ?? date });
    const person = next.professional === undefined ? professional : next.professional;
    if (person) query.set("professional", person);
    if (highlightId) query.set("destaque", highlightId);
    return `/demo/painel/agenda?${query.toString()}`;
  }

  return (
    <>
      <PageHeader eyebrow="Sua agenda" title="Atendimentos" description="Veja o dia, os horários fictícios e o atendimento que você acabou de marcar." icon={CalendarDays} />
      <p className="rounded-2xl bg-metric-ivory px-4 py-3 text-sm leading-6 text-muted-foreground">
        Marcar um horário novo por aqui fica desligado, para não gravar nada no Agendê. O horário entra quando você agenda como cliente.{" "}
        <Link href={DEMO_BOOK_HREF} className="font-medium text-wine-deep underline-offset-4 hover:underline">Agendar como cliente</Link>
      </p>
      {requestedHighlight && !highlighted && !demo.ready ? <p className="text-sm text-muted-foreground">Carregando o horário desta demonstração…</p> : null}
      {requestedHighlight && !highlighted && demo.ready ? <p className="text-sm text-muted-foreground">Esse horário não está nesta sessão do navegador. Reinicie ou agende de novo.</p> : null}
      {highlighted && highlighted.localDate !== date ? (
        <Link href={href({ date: highlighted.localDate, view: "day" })} className="inline-flex min-h-11 items-center text-sm font-medium text-wine-deep underline-offset-4 hover:underline">
          Ver o horário que você marcou em {highlighted.localDate.split("-").reverse().join("/")}
        </Link>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo da agenda">
        <MetricCard label="Na agenda" value={active.length} hint={view === "week" ? "na semana selecionada" : "no dia selecionado"} icon={CalendarCheck2} />
        <MetricCard label="Confirmados" value={visible.filter((item) => item.status === "confirmed").length} hint="clientes confirmados" icon={Clock3} tone="success" />
        <MetricCard label="Em atendimento" value={visible.filter((item) => item.status === "in_progress").length} hint="acontecendo agora" icon={Clock3} tone="warning" />
        <MetricCard label={view === "week" ? "Total da semana" : "Total do dia"} value={formatCentsToReais(active.reduce((sum, item) => sum + item.priceCents, 0))} hint="só horários que ainda valem" icon={CircleDollarSign} tone="neutral" />
      </section>
      <form className="agende-shadow grid gap-3 rounded-3xl bg-card p-4 ring-1 ring-primary/10 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        router.push(href({ professional: String(data.get("professional") ?? "") }));
      }}>
        <div className="grid gap-2">
          <Label htmlFor="professional">Profissional</Label>
          <select id="professional" name="professional" defaultValue={professional} className="h-11 min-h-11 w-full rounded-xl border border-input bg-background px-3">
            <option value="">Toda a equipe</option>
            {DEMO_PROFESSIONALS.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
          </select>
        </div>
        <Button type="submit" variant="outline" className="h-11">Aplicar filtro</Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11" render={<Link href={href({ date: addDaysIso(date, view === "week" ? -7 : -1) })} />}>Anterior</Button>
          <Button variant="outline" className="h-11" render={<Link href={href({ date: demo.today })} />}>Hoje</Button>
          <Button variant="outline" className="h-11" render={<Link href={href({ date: addDaysIso(date, view === "week" ? 7 : 1) })} />}>Próximo</Button>
        </div>
        <div className="flex gap-2">
          <Button variant={view === "day" ? "default" : "outline"} className="h-11" render={<Link href={href({ view: "day" })} />}>Dia</Button>
          <Button variant={view === "week" ? "default" : "outline"} className="h-11" render={<Link href={href({ view: "week" })} />}>Semana</Button>
        </div>
      </div>
      <div className={cn("grid gap-3", view === "week" && "lg:grid-cols-7")}>
        {days.map((day) => {
          const items = visible.filter((item) => item.localDate === day);
          const [, monthNumber, dayNumber] = day.split("-");
          const weekday = weekdayInTimeZone(zonedWallTimeToUtc(day, "12:00", "America/Sao_Paulo"), "America/Sao_Paulo");
          return (
            <section key={day} className="agende-shadow min-w-0 rounded-3xl bg-card p-3 ring-1 ring-primary/10">
              <header className="mb-3">
                <p className="text-sm text-muted-foreground">{WEEKDAYS[weekday] ?? "Agenda"}</p>
                <h2 className={cn("font-serif text-[var(--wine)]", view === "week" ? "text-xl" : "text-3xl")}>{dayNumber}/{monthNumber}</h2>
              </header>
              {items.length === 0 ? <p className="rounded-2xl bg-secondary/50 px-3 py-4 text-sm leading-6 text-muted-foreground">Nada marcado neste dia.</p> : (
                <div className="grid gap-2">
                  {items.map((item) => <AppointmentCard key={item.id} item={item} highlight={item.id === highlightId} onOpen={() => setOpenId(item.id)} />)}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpenId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          {open ? <AppointmentDetail appointment={open} onStatus={(status) => demo.setStatus(open.id, status)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AppointmentCard({ item, highlight, onOpen }: { item: DemoAppointment; highlight: boolean; onOpen: () => void }) {
  return (
    <button id={`demo-appt-${item.id}`} type="button" onClick={onOpen} className={cn("min-h-11 rounded-2xl bg-secondary/40 p-3 text-left ring-1 ring-primary/10 transition-colors hover:bg-secondary", highlight && "bg-metric-blush ring-2 ring-primary")}>
      <p className="font-serif text-lg leading-none text-wine-deep">{item.localStart}–{item.localEnd}</p>
      <p className="mt-2 flex min-w-0 items-center gap-2">
        <PersonMark name={item.clientName} photoUrl={null} size="sm" />
        <span className="min-w-0 font-medium break-words">{item.clientName}</span>
      </p>
      <p className="text-sm break-words text-muted-foreground">{item.serviceName} · {item.professionalName}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", STATUS_CHIP_CLASS[item.status])}>{STATUS_LABEL[item.status]}</span>
        <span className="text-xs text-muted-foreground">{item.durationMinutes} min · {formatCentsToReais(item.priceCents)}</span>
      </div>
      {highlight ? <p className="mt-2 text-xs font-medium text-wine-deep">Seu agendamento de demonstração</p> : null}
    </button>
  );
}

function AppointmentDetail({ appointment, onStatus }: { appointment: DemoAppointment; onStatus: (status: AppointmentStatus) => void }) {
  const next = useMemo(
    () => APPOINTMENT_STATUSES.filter((status) => status !== appointment.status && canTransitionStatus(appointment.status, status, "owner")),
    [appointment.status],
  );
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-serif text-2xl text-wine-deep">{appointment.clientName}</DialogTitle>
        <DialogDescription>{appointment.serviceName} · {appointment.professionalName}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2 text-sm">
        <p><span className="text-muted-foreground">Quando: </span>{appointment.localDate.split("-").reverse().join("/")} · {appointment.localStart}–{appointment.localEnd}</p>
        <p><span className="text-muted-foreground">Valor: </span>{formatCentsToReais(appointment.priceCents)} · {appointment.durationMinutes} min</p>
        <p><span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", STATUS_CHIP_CLASS[appointment.status])}>{STATUS_LABEL[appointment.status]}</span></p>
        {appointment.notes ? <p className="text-muted-foreground">{appointment.notes}</p> : null}
        {appointment.settledByPackage ? <p className="text-muted-foreground">Este atendimento usa uma sessão de pacote. Por isso ele não gera uma nova entrada de serviço no financeiro.</p> : null}
      </div>
      {next.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Atualizar status</p>
          <div className="flex flex-wrap gap-2">
            {next.map((status) => (
              <Button key={status} type="button" variant="outline" className="h-11" onClick={() => onStatus(status)}>{STATUS_LABEL[status]}</Button>
            ))}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">A mudança fica só nesta demonstração. Concluir um atendimento cria a entrada pendente no financeiro, como no Agendê.</p>
        </div>
      ) : <p className="text-sm text-muted-foreground">Este status não muda mais.</p>}
    </>
  );
}
