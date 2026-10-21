"use client";
import { useState, useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { prepareAppointmentWhatsApp } from "@/lib/agenda/whatsapp-actions";
import { Button } from "@/components/ui/button";

export function AppointmentWhatsApp({
  appointmentId,
  confirmed,
  phoneNotice,
}: {
  appointmentId: string;
  confirmed: boolean;
  phoneNotice?: string | null;
}) {
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2 rounded-2xl border p-3">
      {phoneNotice ? (
        <p role="status" className="rounded-2xl bg-metric-sand px-4 py-3 text-sm leading-6">
          {phoneNotice}
        </p>
      ) : (
        <Button
          size="lg"
          className="h-auto min-h-12 w-full whitespace-normal px-4 py-3 text-center leading-snug"
          render={
            <a
              href={`/api/appointments/whatsapp?id=${encodeURIComponent(appointmentId)}`}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <MessageCircle aria-hidden="true" />
          Confirmar pelo WhatsApp
        </Button>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        {confirmed
          ? "O WhatsApp abre com a mensagem de confirmação. Você revisa e envia. Abrir o link não envia a mensagem e não altera o agendamento."
          : "A mensagem avisa que a solicitação ainda aguarda confirmação. Ela não diz que o horário já está confirmado. Abrir ou copiar não altera o agendamento."}
      </p>
      <Button
        variant="ghost"
        className="h-11 w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await prepareAppointmentWhatsApp(appointmentId);
            setMessage(result.message ?? "");
            if (!result.message) {
              setFeedback(result.error ?? "Não foi possível preparar a mensagem.");
              return;
            }
            let copied = false;
            try {
              await navigator.clipboard.writeText(result.message);
              copied = true;
            } catch {
              copied = false;
            }
            if (result.error) {
              setFeedback(
                copied
                  ? `${result.error} A mensagem foi copiada para enviar por outro meio.`
                  : result.error,
              );
              return;
            }
            setFeedback(copied ? "Mensagem copiada. Cole no WhatsApp para enviar." : "Selecione e copie a mensagem abaixo.");
          })
        }
      >
        {pending ? "Preparando..." : "Não abriu? Copiar mensagem"}
      </Button>
      {feedback ? (
        <p role="status" className="text-sm leading-6">
          {feedback}
        </p>
      ) : null}
      {message ? (
        <textarea
          aria-label="Mensagem para copiar"
          readOnly
          value={message}
          className="min-h-44 w-full rounded-xl border p-3 text-sm"
        />
      ) : null}
    </div>
  );
}
