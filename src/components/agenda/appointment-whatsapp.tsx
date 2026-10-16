"use client";
import { useState, useTransition } from "react";
import { prepareAppointmentWhatsApp } from "@/lib/agenda/whatsapp-actions";
import { Button } from "@/components/ui/button";
export function AppointmentWhatsApp({ appointmentId, confirmed }: { appointmentId: string; confirmed: boolean }) {
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  return <div className="grid gap-2 rounded-2xl border p-3">
    <Button variant="outline" render={<a href={`/api/appointments/whatsapp?id=${encodeURIComponent(appointmentId)}`} target="_blank" rel="noopener noreferrer" />}>
      {confirmed ? "Confirmar pelo WhatsApp" : "Solicitação recebida pelo WhatsApp"}
    </Button>
    <p className="text-xs text-muted-foreground">Você revisa e envia a mensagem no WhatsApp. Abrir o link não altera o agendamento.</p>
    <Button variant="ghost" disabled={pending} onClick={() => start(async () => {
      const result = await prepareAppointmentWhatsApp(appointmentId);
      setFeedback(result.error ?? ""); setMessage(result.message ?? "");
      if (result.message) {
        try { await navigator.clipboard.writeText(result.message); setFeedback(result.error ?? "Mensagem copiada. Cole no WhatsApp para enviar."); }
        catch { setFeedback(result.error ?? "Selecione e copie a mensagem abaixo."); }
      }
    })}>{pending ? "Preparando..." : "Não abriu? Copiar mensagem"}</Button>
    {feedback ? <p role="status" className="text-sm">{feedback}</p> : null}
    {message ? <textarea aria-label="Mensagem para copiar" readOnly value={message} className="min-h-44 w-full rounded-xl border p-3 text-sm" /> : null}
  </div>;
}
