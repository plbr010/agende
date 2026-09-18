"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/auth/actions";
import type { ClientRow, ServiceRow, TeamMember } from "@/lib/catalog/queries";
import type { AgendaAppointment } from "@/lib/agenda/queries";
import type { MemberRole } from "@/lib/catalog/queries";
import {
  createAppointmentAction,
  loadSlotsAction,
  rescheduleAppointmentAction,
  setAppointmentStatusAction,
  type SlotActionState,
} from "@/lib/agenda/actions";
import {
  STATUS_LABEL,
  canRescheduleStatus,
  statusActions,
  type AppointmentStatus,
} from "@/lib/agenda/status";
import { addDaysIso, formatTimeInProductTz, todayInProductTz } from "@/lib/time/timezone";
import { WEEKDAYS } from "@/lib/validation/agenda";
import { formatCentsToReais } from "@/lib/validation/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function FormFields({ state, children }: { state: ActionState; children: ReactNode }) {
  return (
    <div className="grid gap-3">
      {children}
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </div>
  );
}

function useAgendaAction(
  serverAction: (prev: ActionState, formData: FormData) => Promise<ActionState>,
  onSuccess?: () => void,
) {
  return useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await serverAction(prev, formData);
    if (result.success) {
      toast.success(result.success);
      onSuccess?.();
    } else if (result.error && !result.fieldErrors) {
      toast.error(result.error);
    }
    return result;
  }, {});
}

async function runFormAction(action: (formData: FormData) => Promise<ActionState>, formData: FormData) {
  const result = await action(formData);
  if (result.error) {
    toast.error(result.error);
  } else if (result.success) {
    toast.success(result.success);
  }
}

const statusVariant: Record<AppointmentStatus, "default" | "secondary" | "outline" | "ghost" | "destructive"> = {
  scheduled: "outline",
  confirmed: "default",
  in_progress: "secondary",
  completed: "ghost",
  cancelled: "destructive",
  no_show: "destructive",
};

export function AgendaBoard({
  view,
  date,
  weekDates,
  appointments,
  professionals,
  services,
  clients,
  selectedProfessionalId,
  role,
  currentMemberId,
}: {
  view: "day" | "week";
  date: string;
  weekDates: string[];
  appointments: AgendaAppointment[];
  professionals: TeamMember[];
  services: ServiceRow[];
  clients: ClientRow[];
  selectedProfessionalId: string;
  role: MemberRole;
  currentMemberId: string | null;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AgendaAppointment | null>(null);
  const bookable = professionals.filter((member) => member.hasProfessionalProfile && member.bookingEnabled);

  return (
    <div className="grid gap-4">
      <form method="get" action="/app/agenda" className="grid gap-3 rounded-xl bg-secondary/40 p-4 ring-1 ring-border sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="professional">Profissional</Label>
          <select
            id="professional"
            name="professional"
            defaultValue={selectedProfessionalId}
            className="h-11 rounded-lg border border-input bg-background px-3"
          >
            <option value="">Toda a equipe</option>
            {bookable.map((member) => (
              <option key={member.memberId} value={member.memberId}>
                {member.displayName ?? member.fullName}
              </option>
            ))}
          </select>
        </div>
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="date" value={date} />
        <Button type="submit" variant="outline" className="h-11">
          Filtrar
        </Button>
        <Button type="button" className="h-11" onClick={() => setCreating(true)}>
          Novo agendamento
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11" render={<Link href={navHref(view, addDaysIso(date, view === "week" ? -7 : -1), selectedProfessionalId)} />}>
            Anterior
          </Button>
          <Button variant="outline" className="h-11" render={<Link href={navHref(view, todayInProductTz(), selectedProfessionalId)} />}>
            Hoje
          </Button>
          <Button variant="outline" className="h-11" render={<Link href={navHref(view, addDaysIso(date, view === "week" ? 7 : 1), selectedProfessionalId)} />}>
            Próximo
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === "day" ? "default" : "outline"}
            className="h-11"
            render={<Link href={navHref("day", date, selectedProfessionalId)} />}
          >
            Dia
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            className="h-11"
            render={<Link href={navHref("week", date, selectedProfessionalId)} />}
          >
            Semana
          </Button>
        </div>
      </div>

      {view === "day" ? (
        <DayColumn
          date={date}
          items={appointments.filter((item) => item.localDate === date)}
          onOpen={setEditing}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7 lg:gap-2">
          {weekDates.map((day, index) => (
            <DayColumn
              key={day}
              date={day}
              weekdayLabel={WEEKDAYS[index]?.label ?? ""}
              compact
              items={appointments.filter((item) => item.localDate === day)}
              onOpen={setEditing}
            />
          ))}
        </div>
      )}

      <AppointmentFormDialog
        open={creating}
        onOpenChange={setCreating}
        professionals={bookable}
        services={services}
        clients={clients}
        defaultDate={date}
        defaultProfessionalId={selectedProfessionalId}
      />
      {editing ? (
        <AppointmentDetailDialog
          appointment={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          professionals={bookable}
          services={services}
          role={role}
          currentMemberId={currentMemberId}
        />
      ) : null}
    </div>
  );
}

function navHref(view: string, date: string, professional: string) {
  const params = new URLSearchParams({ view, date });
  if (professional) {
    params.set("professional", professional);
  }
  return `/app/agenda?${params.toString()}`;
}

function DayColumn({
  date,
  items,
  onOpen,
  weekdayLabel,
  compact,
}: {
  date: string;
  items: AgendaAppointment[];
  onOpen: (item: AgendaAppointment) => void;
  weekdayLabel?: string;
  compact?: boolean;
}) {
  const [, month, day] = date.split("-");
  return (
    <section className="min-w-0 rounded-xl bg-card p-3 ring-1 ring-border">
      <header className="mb-3">
        <p className="text-sm text-muted-foreground">{weekdayLabel ?? "Agenda"}</p>
        <h2 className={cn("font-serif", compact ? "text-lg" : "text-2xl")}>
          {day}/{month}
        </h2>
      </header>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum horário neste dia.</p>
      ) : (
        <div className="grid gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item)}
              className="rounded-xl bg-secondary/50 p-3 text-left ring-1 ring-border transition-colors hover:bg-secondary"
            >
              <p className="text-sm font-medium">
                {item.localStart}–{item.localEnd}
              </p>
              <p className="truncate font-serif text-base">{item.clientName}</p>
              <p className="truncate text-sm text-muted-foreground">{item.serviceName}</p>
              <p className="truncate text-sm text-muted-foreground">{item.professionalName}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant={statusVariant[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                <Badge variant="ghost">{item.durationMinutes} min</Badge>
                <Badge variant="ghost">{formatCentsToReais(item.priceCents)}</Badge>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function AppointmentFormDialog({
  open,
  onOpenChange,
  professionals,
  services,
  clients,
  defaultDate,
  defaultProfessionalId,
  appointment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionals: TeamMember[];
  services: ServiceRow[];
  clients: ClientRow[];
  defaultDate: string;
  defaultProfessionalId?: string;
  appointment?: AgendaAppointment;
}) {
  const [slotState, slotAction, slotPending] = useActionState(loadSlotsAction, {} as SlotActionState);
  const action = appointment ? rescheduleAppointmentAction : createAppointmentAction;
  const [state, formAction, pending] = useAgendaAction(action, () => onOpenChange(false));
  const slots = slotState.slots ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{appointment ? "Reagendar" : "Novo agendamento"}</DialogTitle>
          <DialogDescription>
            Preço e duração são calculados no servidor. O horário precisa caber na jornada.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {appointment ? <input type="hidden" name="appointmentId" value={appointment.id} /> : null}
          <FormFields state={state}>
            {appointment ? null : (
              <div className="grid gap-2">
                <Label htmlFor="clientId">Cliente</Label>
                <select id="clientId" name="clientId" required className="h-11 rounded-lg border border-input bg-background px-3" defaultValue="">
                  <option value="" disabled>
                    Selecione
                  </option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="professionalMemberId">Profissional</Label>
              <select
                id="professionalMemberId"
                name="professionalMemberId"
                required
                className="h-11 rounded-lg border border-input bg-background px-3"
                defaultValue={appointment?.professionalMemberId ?? defaultProfessionalId ?? ""}
              >
                <option value="" disabled>
                  Selecione
                </option>
                {professionals.map((member) => (
                  <option key={member.memberId} value={member.memberId}>
                    {member.displayName ?? member.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="serviceId">Serviço</Label>
              <select
                id="serviceId"
                name="serviceId"
                required
                className="h-11 rounded-lg border border-input bg-background px-3"
                defaultValue={appointment?.serviceId ?? ""}
              >
                <option value="" disabled>
                  Selecione
                </option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {service.durationMinutes} min
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="localDate">Dia</Label>
              <Input id="localDate" name="localDate" type="date" defaultValue={appointment?.localDate ?? defaultDate} className="h-11" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" name="notes" defaultValue={appointment?.notes ?? ""} />
            </div>
            {slots.length > 0 ? (
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium">Horário</legend>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => (
                    <label key={slot} className="flex items-center justify-center gap-1 rounded-lg bg-secondary/60 px-2 py-2 text-sm ring-1 ring-border">
                      <input type="radio" name="startsAt" value={slot} required className="size-4" />
                      {formatTimeInProductTz(slot)}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="text-sm text-muted-foreground">
                Busque os horários livres depois de escolher profissional, serviço e dia.
              </p>
            )}
          </FormFields>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button formAction={slotAction} type="submit" variant="outline" disabled={slotPending} className="h-11 w-full">
              {slotPending ? "Buscando..." : "Ver horários livres"}
            </Button>
            <Button type="submit" disabled={pending || slots.length === 0} className="h-11 w-full">
              {pending ? "Salvando..." : appointment ? "Reagendar" : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AppointmentDetailDialog({
  appointment,
  open,
  onOpenChange,
  professionals,
  services,
  role,
  currentMemberId,
}: {
  appointment: AgendaAppointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionals: TeamMember[];
  services: ServiceRow[];
  role: MemberRole;
  currentMemberId: string | null;
}) {
  const [rescheduling, setRescheduling] = useState(false);
  const actions = statusActions(appointment.status, role);
  const canEdit =
    canRescheduleStatus(appointment.status) &&
    (role === "owner" || role === "admin" || role === "receptionist" || currentMemberId === appointment.professionalMemberId);

  return (
    <>
      <Dialog open={open && !rescheduling} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{appointment.clientName}</DialogTitle>
            <DialogDescription>
              {appointment.localStart}–{appointment.localEnd} · {appointment.serviceName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 text-sm">
            <p>Profissional: {appointment.professionalName}</p>
            <p>Duração: {appointment.durationMinutes} min</p>
            <p>Preço: {formatCentsToReais(appointment.priceCents)}</p>
            {appointment.notes ? <p>Obs.: {appointment.notes}</p> : null}
            <Badge variant={statusVariant[appointment.status]} className="w-fit">
              {STATUS_LABEL[appointment.status]}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button type="button" variant="outline" className="h-11" onClick={() => setRescheduling(true)}>
                Reagendar
              </Button>
            ) : null}
            {actions.map((status) => (
              <form
                key={status}
                action={(formData) => runFormAction(setAppointmentStatusAction, formData)}
              >
                <input type="hidden" name="appointmentId" value={appointment.id} />
                <input type="hidden" name="status" value={status} />
                <Button type="submit" variant="outline" className="h-11">
                  {STATUS_LABEL[status]}
                </Button>
              </form>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <AppointmentFormDialog
        open={rescheduling}
        onOpenChange={(next) => {
          setRescheduling(next);
          if (!next) {
            onOpenChange(false);
          }
        }}
        professionals={professionals}
        services={services}
        clients={[]}
        defaultDate={appointment.localDate}
        appointment={appointment}
      />
    </>
  );
}
