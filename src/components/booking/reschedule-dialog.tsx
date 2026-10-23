"use client";

import { useEffect, useState, useTransition } from "react";
import type { MyAppointment, PublicBookingCatalog } from "@/lib/booking/queries";
import { fetchMyRescheduleSlots, loadCatalogAction, rescheduleMyAppointmentAction } from "@/lib/booking/actions";
import { addDaysIso, formatDateTimeInTimeZone, formatTimeInTimeZone, todayInTimeZone } from "@/lib/time/timezone";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MISSING_SERVICE_MESSAGE = "Não é possível reagendar este horário por aqui. Fale com o salão.";

export function RescheduleDialog({
  appointment,
  onClose,
  onSaved,
}: {
  appointment: MyAppointment;
  onClose: () => void;
  onSaved: (items: MyAppointment[]) => void;
}) {
  const canReschedule = Boolean(appointment.serviceId);
  const [catalog, setCatalog] = useState<PublicBookingCatalog | null>(null);
  const [date, setDate] = useState(() => todayInTimeZone(appointment.timezone));
  const [professional, setProfessional] = useState(appointment.professionalMemberId ?? "");
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState("");
  const [error, setError] = useState(canReschedule ? "" : MISSING_SERVICE_MESSAGE);
  const [loading, setLoading] = useState(canReschedule);
  const [attempt, setAttempt] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!appointment.serviceId) {
      return;
    }
    let active = true;
    loadCatalogAction(appointment.slug)
      .then((data) => {
        if (!active) return;
        setCatalog(data);
        if (!data) {
          setError("Não foi possível carregar a disponibilidade. Tente novamente.");
          setLoading(false);
        } else {
          const eligible = data.professionals.filter((person) => person.serviceIds.includes(appointment.serviceId!));
          const assignedIsEligible = eligible.some((person) => person.id === appointment.professionalMemberId);
          setProfessional((current) => eligible.some((person) => person.id === current) ? current : "");
          setError(eligible.length ? "" : "Nenhum profissional disponível para este serviço. Fale com o salão.");
          setLoading(assignedIsEligible);
        }
      })
      .catch(() => {
        if (active) {
          setError("Não deu certo carregar quem atende. Tente de novo.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [appointment.slug, appointment.serviceId, appointment.professionalMemberId, attempt]);

  useEffect(() => {
    if (!catalog || !professional || !appointment.serviceId || !catalog.professionals.some((person) => person.id === professional && person.serviceIds.includes(appointment.serviceId!))) {
      return;
    }
    let active = true;
    fetchMyRescheduleSlots({
      appointmentId: appointment.id,
      professionalMemberId: professional,
      localDate: date,
    })
      .then((result) => {
        if (!active) return;
        setSlots(result.slots);
        setError(result.error ?? "");
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("Não deu certo ver os horários. Tente outra data.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [catalog, professional, date, appointment.serviceId, appointment.id, attempt]);

  function changeSelection() {
    setSlot("");
    setSlots([]);
    setLoading(true);
    setConfirming(false);
    setError("");
  }

  function save() {
    start(async () => {
      try {
        const result = await rescheduleMyAppointmentAction({
          appointmentId: appointment.id,
          startsAt: slot,
          professionalMemberId: professional,
        });
        if (result.error) {
          setError(result.error);
          setConfirming(false);
          setSlot("");
        } else if (result.appointments) {
          onSaved(result.appointments);
        }
      } catch {
        setError("Não foi possível confirmar. Atualize seus agendamentos antes de tentar novamente.");
      }
    });
  }

  const professionals = catalog?.professionals.filter((person) => person.serviceIds.includes(appointment.serviceId ?? "")) ?? [];
  const selectedName = professionals.find((person) => person.id === professional)?.displayName;

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reagendar {appointment.serviceName}</DialogTitle>
          <DialogDescription>
            Horário do salão. O valor continua o mesmo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="reschedule-professional">Profissional</Label>
            <select
              id="reschedule-professional"
              value={professional}
              disabled={pending || confirming || !canReschedule}
              onChange={(event) => {
                changeSelection();
                setProfessional(event.target.value);
              }}
              className="h-11 rounded-xl border border-input bg-background px-3"
            >
              <option value="" disabled>
                Selecione
              </option>
              {professionals.map((person) => (
                <option value={person.id} key={person.id}>
                  {person.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reschedule-date">Nova data</Label>
            <Input
              id="reschedule-date"
              type="date"
              value={date}
              min={todayInTimeZone(appointment.timezone)}
              max={addDaysIso(todayInTimeZone(appointment.timezone), catalog?.horizonDays ?? 90)}
              disabled={pending || confirming || !canReschedule}
              onChange={(event) => {
                if (event.target.value) {
                  changeSelection();
                  setDate(event.target.value);
                }
              }}
              className="h-11"
            />
          </div>
          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Buscando horários...
            </p>
          ) : error ? null : !professional ? (
            <p className="text-sm text-muted-foreground">Selecione um profissional para ver os horários.</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum horário disponível nesta data.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={slot === item ? "default" : "outline"}
                  className="min-h-12 rounded-2xl"
                  disabled={pending || confirming}
                  onClick={() => setSlot(item)}
                >
                  {formatTimeInTimeZone(item, appointment.timezone)}
                </Button>
              ))}
            </div>
          )}
          {error ? (
            <div className="grid gap-3">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
              {canReschedule ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-full"
                  disabled={pending || loading}
                  onClick={() => {
                    setError("");
                    setLoading(true);
                    setAttempt((value) => value + 1);
                  }}
                >
                  Tentar de novo
                </Button>
              ) : null}
            </div>
          ) : null}
          {confirming ? (
            <>
              <p className="text-sm">
                Confirmar mudança para {formatDateTimeInTimeZone(slot, appointment.timezone)}
                {selectedName ? ` com ${selectedName}` : ""}?
              </p>
              <Button className="h-11" disabled={pending} onClick={save}>
                {pending ? "Salvando..." : "Confirmar reagendamento"}
              </Button>
              <Button variant="outline" className="h-11" disabled={pending} onClick={() => setConfirming(false)}>
                Voltar
              </Button>
            </>
          ) : (
            <Button className="h-11" disabled={!slot || loading || pending || !canReschedule} onClick={() => setConfirming(true)}>
              Revisar alteração
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
