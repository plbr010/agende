"use client";

import Link from "next/link";
import { AppointmentWhatsApp } from "./appointment-whatsapp";
import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import { STATUS_ACTION_LABEL } from "@/lib/usability/copy";
import { toast } from "sonner";
import type { ActionState } from "@/lib/auth/actions";
import type { ClientRow, ServiceRow, TeamMember } from "@/lib/catalog/queries";
import { clientPhoneNotice } from "@/lib/agenda/phone-notice";
import type { AgendaAppointment } from "@/lib/agenda/queries";
import type { MemberRole } from "@/lib/catalog/queries";
import {
  completeAppointmentCheckoutAction,
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
} from "@/lib/agenda/status";
import { addDaysIso, formatTimeInTimeZone, todayInTimeZone } from "@/lib/time/timezone";
import { WEEKDAYS } from "@/lib/validation/agenda";
import { formatCentsToReais } from "@/lib/validation/money";
import { extractBrNationalDigits, formatPhoneBr } from "@/lib/validation/phone";
import { STATUS_CHIP_CLASS } from "@/lib/agenda/status-style";
import { PersonMark } from "@/components/people/person-mark";
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

export type SellableProduct = { id: string; name: string };

export function AgendaBoard({
  workspaceName,
  timezone,
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
  sellableProducts = [],
  startCreating = false,
}: {
  workspaceName: string;
  timezone: string;
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
  sellableProducts?: SellableProduct[];
  startCreating?: boolean;
}) {
  const [creating, setCreating] = useState(startCreating);
  const [editing, setEditing] = useState<AgendaAppointment | null>(null);
  const currentEditing = editing ? appointments.find(item => item.id === editing.id) ?? null : null;
  const bookable = professionals.filter((member) => member.hasProfessionalProfile && member.bookingEnabled);

  return (
    <div className="grid gap-4">
      <form method="get" action="/app/agenda" className="agende-shadow grid gap-3 rounded-3xl bg-card p-4 ring-1 ring-primary/10 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <div className="grid gap-2">
          <Label htmlFor="professional">Profissional</Label>
          <select
            id="professional"
            name="professional"
            defaultValue={selectedProfessionalId}
            className="h-11 min-h-11 w-full rounded-xl border border-input bg-background px-3"
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
          Aplicar filtro
        </Button>
        <Button type="button" className="h-11" onClick={() => setCreating(true)}>
          Novo horário
        </Button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11" render={<Link href={navHref(view, addDaysIso(date, view === "week" ? -7 : -1), selectedProfessionalId)} />}>
            Anterior
          </Button>
          <Button variant="outline" className="h-11" render={<Link href={navHref(view, todayInTimeZone(timezone), selectedProfessionalId)} />}>
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
        <div className="grid gap-3 lg:grid-cols-7 lg:gap-2">
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
        timezone={timezone}
        open={creating}
        onOpenChange={setCreating}
        professionals={bookable}
        services={services}
        clients={clients}
        defaultDate={date}
        defaultProfessionalId={selectedProfessionalId}
      />
      {currentEditing ? (
        <AppointmentDetailDialog
          workspaceName={workspaceName}
          timezone={timezone}
          appointment={currentEditing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          professionals={bookable}
          services={services}
          role={role}
          currentMemberId={currentMemberId}
          sellableProducts={sellableProducts}
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
    <section className="agende-shadow min-w-0 rounded-3xl bg-card p-3 ring-1 ring-primary/10">
      <header className="mb-3">
        <p className="text-sm text-muted-foreground">{weekdayLabel ?? "Agenda"}</p>
        <h2 className={cn("font-serif text-[var(--wine)]", compact ? "text-xl" : "text-3xl")}>
          {day}/{month}
        </h2>
      </header>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-secondary/50 px-3 py-4 text-sm leading-6 text-muted-foreground">
          Nada marcado neste dia. Toque em Novo horário para marcar.
        </p>
      ) : (
        <div className="grid gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item)}
              className="min-h-11 rounded-2xl bg-secondary/40 p-3 text-left ring-1 ring-primary/10 transition-colors hover:bg-secondary"
            >
              <p className="font-serif text-lg leading-none text-wine-deep">
                {item.localStart}–{item.localEnd}
              </p>
              <p className="mt-2 flex min-w-0 items-center gap-2">
                <PersonMark name={item.clientName} photoUrl={`/api/clients/avatar?clientId=${item.clientId}`} size="sm" />
                <span className="min-w-0 font-medium break-words">{item.clientName}</span>
              </p>
              <p className="text-sm break-words text-muted-foreground">{item.serviceName} · {item.professionalName}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", STATUS_CHIP_CLASS[item.status])}>
                  {STATUS_LABEL[item.status]}
                </span>
                <span className="text-xs text-muted-foreground">{item.durationMinutes} min · {formatCentsToReais(item.priceCents)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function AppointmentFormDialog({
  timezone,
  open,
  onOpenChange,
  professionals,
  services,
  clients,
  defaultDate,
  defaultProfessionalId,
  appointment,
}: {
  timezone: string;
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
  const [professionalMemberId, setProfessionalMemberId] = useState(
    appointment?.professionalMemberId ?? defaultProfessionalId ?? "",
  );
  const [serviceId, setServiceId] = useState(appointment?.serviceId ?? "");
  const [localDate, setLocalDate] = useState(appointment?.localDate ?? defaultDate);
  const slotQueryKey = `${professionalMemberId}|${serviceId}|${localDate}`;
  const loadedQueryKey = `${slotState.professionalMemberId ?? ""}|${slotState.serviceId ?? ""}|${slotState.localDate ?? ""}`;
  const slots = slotPending || loadedQueryKey !== slotQueryKey ? [] : (slotState.slots ?? []);

  useEffect(() => {
    if (!open || !professionalMemberId || !serviceId || !localDate) {
      return;
    }
    const data = new FormData();
    data.set("professionalMemberId", professionalMemberId);
    data.set("serviceId", serviceId);
    data.set("localDate", localDate);
    slotAction(data);
  }, [open, professionalMemberId, serviceId, localDate, slotAction]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{appointment ? "Trocar horário" : "Novo horário"}</DialogTitle>
          <DialogDescription>
            O valor e o tempo vêm do serviço escolhido. Escolha um horário dentro do expediente.
          </DialogDescription>
        </DialogHeader>
        {!appointment && (clients.length === 0 || services.length === 0 || professionals.length === 0) ? (
          <div className="grid gap-3 rounded-2xl bg-secondary/50 px-4 py-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Antes de agendar, complete o básico:</p>
            {clients.length === 0 ? (
              <Button variant="outline" className="h-11 w-full justify-start" render={<Link href="/app/clientes?novo=1" />}>
                Cadastre ao menos uma cliente
              </Button>
            ) : null}
            {services.length === 0 ? (
              <Button variant="outline" className="h-11 w-full justify-start" render={<Link href="/app/servicos" />}>
                Cadastre um serviço com profissional
              </Button>
            ) : null}
            {professionals.length === 0 ? (
              <Button variant="outline" className="h-11 w-full justify-start" render={<Link href="/app/equipe" />}>
                Ative um profissional na equipe
              </Button>
            ) : null}
            <p>Depois, em Equipe, toque em Horários de trabalho e informe quando você atende.</p>
          </div>
        ) : null}
        <form action={formAction} className="grid gap-4">
          {appointment ? <input type="hidden" name="appointmentId" value={appointment.id} /> : null}
          <FormFields state={state}>
            {appointment ? null : (
              <div className="grid gap-2">
                <Label htmlFor="clientId">Cliente</Label>
                <select id="clientId" name="clientId" required className="h-11 min-h-11 w-full rounded-xl border border-input bg-background px-3" defaultValue="">
                  <option value="" disabled>
                    {clients.length === 0 ? "Nenhuma cliente cadastrada" : "Selecione"}
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
                className="h-11 min-h-11 w-full rounded-xl border border-input bg-background px-3"
                value={professionalMemberId}
                onChange={(event) => setProfessionalMemberId(event.target.value)}
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
                className="h-11 min-h-11 w-full rounded-xl border border-input bg-background px-3"
                value={serviceId}
                onChange={(event) => setServiceId(event.target.value)}
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
              <Input
                id="localDate"
                name="localDate"
                type="date"
                value={localDate}
                onChange={(event) => setLocalDate(event.target.value)}
                className="h-11"
                required
              />
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
                    <label key={slot} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-secondary/60 px-2 py-2 text-sm ring-1 ring-border has-[:checked]:ring-2 has-[:checked]:ring-primary">
                      <input type="radio" name="startsAt" value={slot} required className="size-5" disabled={slotPending} />
                      {formatTimeInTimeZone(slot, timezone)}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="text-sm text-muted-foreground">
                {slotPending
                  ? "Buscando horários livres…"
                  : slotState.error
                    ? slotState.error
                    : "Escolha profissional, serviço e dia. Os horários livres aparecem aqui."}
              </p>
            )}
          </FormFields>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button formAction={slotAction} type="submit" variant="outline" disabled={slotPending} className="h-11 w-full">
              {slotPending ? "Buscando..." : "Atualizar horários livres"}
            </Button>
            <Button type="submit" disabled={pending || slotPending || slots.length === 0} className="h-11 w-full">
              {pending ? "Salvando..." : appointment ? "Confirmar novo horário" : "Agendar"}
            </Button>
            <Button type="button" variant="ghost" className="h-11 w-full" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{value}</dd>
    </div>
  );
}

function displayClientPhone(phone: string | null): string {
  if (!phone?.trim()) return "Telefone não informado";
  if (extractBrNationalDigits(phone)) return formatPhoneBr(phone);
  return phone.trim();
}

const WHATSAPP_UNAVAILABLE: Partial<Record<AgendaAppointment["status"], string>> = {
  cancelled: "Este horário foi cancelado. Não há confirmação pelo WhatsApp.",
  no_show: "Este horário foi marcado como falta. Não há confirmação pelo WhatsApp.",
  completed: "Este atendimento já foi concluído. Não há confirmação pelo WhatsApp.",
  in_progress: "Este atendimento já começou. Não há confirmação pelo WhatsApp.",
};

export function AppointmentDetailDialog({
  workspaceName,
  timezone,
  appointment,
  open,
  onOpenChange,
  professionals,
  services,
  role,
  currentMemberId,
  sellableProducts = [],
}: {
  workspaceName: string;
  timezone: string;
  appointment: AgendaAppointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionals: TeamMember[];
  services: ServiceRow[];
  role: MemberRole;
  currentMemberId: string | null;
  sellableProducts?: SellableProduct[];
}) {
  const [rescheduling, setRescheduling] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutKey, setCheckoutKey] = useState("");
  const [statusPending, startStatus] = useTransition();
  const [checkoutState, checkoutAction, checkoutPending] = useAgendaAction(
    async (_previous, formData) => completeAppointmentCheckoutAction(formData),
    () => {
      setCheckingOut(false);
      onOpenChange(false);
    },
  );
  const actions = statusActions(appointment.status, role);
  const canEdit =
    canRescheduleStatus(appointment.status) &&
    (role === "owner" || role === "admin" || role === "receptionist" || currentMemberId === appointment.professionalMemberId);
  const canNotify =
    role === "owner" ||
    role === "admin" ||
    role === "receptionist" ||
    (role === "professional" && currentMemberId === appointment.professionalMemberId);
  const whatsAppUnavailable = WHATSAPP_UNAVAILABLE[appointment.status];

  return (
    <>
      <Dialog open={open && !rescheduling} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 pr-10">
              <PersonMark name={appointment.clientName} photoUrl={`/api/clients/avatar?clientId=${appointment.clientId}`} size="sm" />
              <span className="min-w-0 break-words">{appointment.clientName}</span>
            </DialogTitle>
            <DialogDescription className="break-words">
              {workspaceName} · {appointment.serviceName} · {appointment.localStart}–{appointment.localEnd}
            </DialogDescription>
          </DialogHeader>
          <dl className="grid gap-3 text-sm">
            <DetailRow label="Cliente" value={appointment.clientName} />
            <DetailRow label="WhatsApp" value={displayClientPhone(appointment.clientPhone)} />
            <DetailRow label="Serviço" value={appointment.serviceName} />
            <div className="grid gap-1">
              <dt className="text-muted-foreground">Profissional</dt>
              <dd className="flex min-w-0 items-center gap-2 font-medium">
                <PersonMark name={appointment.professionalName} photoUrl={`/api/professionals/photo?memberId=${appointment.professionalMemberId}`} size="sm" />
                <span className="min-w-0 break-words">{appointment.professionalName}</span>
              </dd>
            </div>
            <DetailRow label="Data" value={appointment.localDate.split("-").reverse().join("/")} />
            <DetailRow label="Horário" value={`${appointment.localStart}–${appointment.localEnd}`} />
            <DetailRow label="Duração" value={`${appointment.durationMinutes} min`} />
            <DetailRow label="Preço" value={formatCentsToReais(appointment.priceCents)} />
            {appointment.notes ? (
              <div className="grid gap-1">
                <dt className="text-muted-foreground">Observação</dt>
                <dd>{appointment.notes}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", STATUS_CHIP_CLASS[appointment.status])}>
                  {STATUS_LABEL[appointment.status]}
                </span>
              </dd>
            </div>
          </dl>
          {canNotify && (appointment.status === "scheduled" || appointment.status === "confirmed") ? (
            <div className="grid min-w-0 gap-2 rounded-[1.25rem] bg-metric-blush p-4 ring-1 ring-[#f0e4de]">
              <p className="text-sm font-medium text-wine-deep">WhatsApp</p>
              <AppointmentWhatsApp
                key={`${appointment.id}-${appointment.status}-${appointment.startsAt}-${appointment.clientPhone ?? ""}`}
                appointmentId={appointment.id}
                confirmed={appointment.status === "confirmed"}
                phoneNotice={clientPhoneNotice(appointment.clientPhone)}
              />
            </div>
          ) : null}
          {canNotify && whatsAppUnavailable ? (
            <p role="status" className="rounded-2xl bg-secondary/70 px-4 py-3 text-sm leading-6">
              {whatsAppUnavailable}
            </p>
          ) : null}
          {canEdit || actions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <p className="w-full text-sm font-medium text-wine-deep">Atualizar o horário</p>
            {canEdit ? (
              <Button type="button" variant="outline" className="h-11" onClick={() => setRescheduling(true)} disabled={statusPending}>
                Trocar horário
              </Button>
            ) : null}
            {actions.map((status) => status === "completed" ? (
              <Button key={status} type="button" variant="outline" className="h-11" disabled={statusPending} onClick={() => { setCheckoutKey(crypto.randomUUID()); setCheckingOut(true); }}>
                {STATUS_ACTION_LABEL[status]}
              </Button>
            ) : (
              <form
                key={status}
                action={(formData) => {
                  if (statusPending) return;
                  startStatus(() => {
                    void runFormAction(setAppointmentStatusAction, formData);
                  });
                }}
              >
                <input type="hidden" name="appointmentId" value={appointment.id} />
                <input type="hidden" name="status" value={status} />
                <Button type="submit" variant="outline" className="h-11" disabled={statusPending} aria-busy={statusPending}>
                  {statusPending ? "Salvando..." : STATUS_ACTION_LABEL[status]}
                </Button>
              </form>
            ))}
          </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Dialog open={checkingOut} onOpenChange={setCheckingOut}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Concluir atendimento</DialogTitle>
            <DialogDescription>
              {appointment.clientName} · {appointment.serviceName} · {formatCentsToReais(appointment.priceCents)}. Concluir não significa que o dinheiro já entrou.
            </DialogDescription>
          </DialogHeader>
          <form action={checkoutAction} className="grid gap-4">
            <input type="hidden" name="appointmentId" value={appointment.id} />
            <input type="hidden" name="idempotencyKey" value={checkoutKey} />
            <FormFields state={checkoutState}>
              <div className="grid gap-2">
                <Label htmlFor="checkout-discount">Desconto (R$)</Label>
                <Input id="checkout-discount" name="discount" inputMode="decimal" placeholder="0,00" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="checkout-received">Valor recebido agora (R$)</Label>
                <Input id="checkout-received" name="received" inputMode="decimal" placeholder="0,00" />
                <p className="text-sm text-muted-foreground">Deixe em branco se a cliente ainda vai pagar.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="checkout-method">Forma de pagamento</Label>
                <select id="checkout-method" name="paymentMethod" className="h-11 rounded-2xl border bg-background px-3 text-sm">
                  <option value="">Ainda não recebi</option>
                  <option value="pix">Pix</option>
                  <option value="cash">Dinheiro</option>
                  <option value="debit_card">Cartão de débito</option>
                  <option value="credit_card">Cartão de crédito</option>
                  <option value="bank_transfer">Transferência</option>
                  <option value="other">Outro</option>
                </select>
              </div>
              {sellableProducts.length > 0 ? (
                <div className="grid gap-2 rounded-2xl bg-secondary/50 p-3">
                  <Label htmlFor="checkout-product">Produto vendido, se houver</Label>
                  <select id="checkout-product" name="productId" className="h-11 rounded-2xl border bg-background px-3 text-sm" defaultValue="">
                    <option value="">Nenhum produto</option>
                    {sellableProducts.map((product) => (
                      <option key={product.id} value={product.id}>{product.name}</option>
                    ))}
                  </select>
                  <Label htmlFor="checkout-quantity">Quantidade</Label>
                  <Input id="checkout-quantity" name="productQuantity" inputMode="numeric" placeholder="1" />
                  <Label htmlFor="checkout-price">Preço unitário (R$)</Label>
                  <Input id="checkout-price" name="productPrice" inputMode="decimal" placeholder="0,00" />
                </div>
              ) : null}
            </FormFields>
            <DialogFooter>
              <Button type="button" variant="outline" className="h-11" onClick={() => setCheckingOut(false)}>Voltar</Button>
              <Button type="submit" className="h-11" disabled={checkoutPending} aria-busy={checkoutPending}>
                {checkoutPending ? "Salvando..." : "Confirmar conclusão"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AppointmentFormDialog
        timezone={timezone}
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
