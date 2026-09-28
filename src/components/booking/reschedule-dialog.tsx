"use client";

import { useEffect, useState, useTransition } from "react";
import type { MyAppointment, PublicBookingCatalog } from "@/lib/booking/queries";
import { fetchMyRescheduleSlots, loadCatalogAction, rescheduleMyAppointmentAction } from "@/lib/booking/actions";
import { addDaysIso, formatDateTimeInTimeZone, formatTimeInTimeZone, todayInTimeZone } from "@/lib/time/timezone";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RescheduleDialog({ appointment, onClose, onSaved }: {
  appointment: MyAppointment; onClose: () => void; onSaved: (items: MyAppointment[]) => void;
}) {
  const [catalog, setCatalog] = useState<PublicBookingCatalog | null>(null);
  const [date, setDate] = useState(todayInTimeZone(appointment.timezone));
  const [professional, setProfessional] = useState(appointment.professionalMemberId ?? "");
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  useEffect(() => {
    let active = true;
    loadCatalogAction(appointment.slug).then(data => {
      if (!active) return;
      setCatalog(data);
      if (!data) { setError("Não foi possível carregar a disponibilidade. Tente novamente."); setLoading(false); }
    }).catch(() => { if (active) { setError("Falha ao carregar profissionais."); setLoading(false); } });
    return () => { active = false; };
  }, [appointment.slug]);
  useEffect(() => {
    if (!catalog || !professional || !appointment.serviceId) return;
    let active = true;
    fetchMyRescheduleSlots({ appointmentId: appointment.id, professionalMemberId: professional, localDate: date })
      .then(result => { if (active) { setSlots(result.slots); setError(result.error ?? ""); setLoading(false); } })
      .catch(() => { if (active) { setError("Falha ao consultar horários. Tente outra data."); setLoading(false); } });
    return () => { active = false; };
  }, [catalog, professional, date, appointment.serviceId, appointment.id]);
  function changeSelection() { setSlot(""); setSlots([]); setLoading(true); setConfirming(false); setError(""); }
  function save() {
    start(async () => {
      try {
        const result = await rescheduleMyAppointmentAction({ appointmentId: appointment.id, startsAt: slot, professionalMemberId: professional });
        if (result.error) { setError(result.error); setConfirming(false); setSlot(""); }
        else if (result.appointments) onSaved(result.appointments);
      } catch { setError("Não foi possível confirmar. Atualize seus agendamentos antes de tentar novamente."); }
    });
  }
  const professionals = catalog?.professionals.filter(p => p.serviceIds.includes(appointment.serviceId ?? "")) ?? [];
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}><DialogContent><DialogHeader>
    <DialogTitle>Reagendar {appointment.serviceName}</DialogTitle><DialogDescription>Horários no fuso {appointment.timezone}. O preço e a duração do agendamento são preservados.</DialogDescription>
  </DialogHeader><div className="grid gap-4">
    <Label htmlFor="reschedule-professional">Profissional</Label>
    <select id="reschedule-professional" value={professional} disabled={pending || confirming} onChange={e => { changeSelection(); setProfessional(e.target.value); }}>
      <option value="" disabled>Selecione</option>{professionals.map(p => <option value={p.id} key={p.id}>{p.displayName}</option>)}
    </select>
    <Label htmlFor="reschedule-date">Nova data</Label><Input id="reschedule-date" type="date" value={date} min={todayInTimeZone(appointment.timezone)} max={addDaysIso(todayInTimeZone(appointment.timezone), catalog?.horizonDays ?? 90)} disabled={pending || confirming} onChange={e => { if (e.target.value) { changeSelection(); setDate(e.target.value); } }} />
    {loading ? <p role="status">Buscando horários...</p> : slots.length === 0 ? <p>Nenhum horário disponível nesta data.</p> : <div className="flex flex-wrap gap-2">{slots.map(s => <Button key={s} variant={slot === s ? "default" : "outline"} disabled={pending || confirming} onClick={() => setSlot(s)}>{formatTimeInTimeZone(s, appointment.timezone)}</Button>)}</div>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {confirming ? <><p>Confirmar mudança para {formatDateTimeInTimeZone(slot, appointment.timezone)} com {professionals.find(p => p.id === professional)?.displayName}?</p>
      <Button disabled={pending} onClick={save}>{pending ? "Salvando..." : "Confirmar reagendamento"}</Button><Button variant="outline" disabled={pending} onClick={() => setConfirming(false)}>Voltar</Button></>
      : <Button disabled={!slot || loading || pending} onClick={() => setConfirming(true)}>Revisar alteração</Button>}
  </div></DialogContent></Dialog>;
}
