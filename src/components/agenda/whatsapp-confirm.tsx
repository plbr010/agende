"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { WhatsAppConfirmationPlan } from "@/lib/agenda/whatsapp-confirmation";
import { copyTextToClipboard } from "@/lib/usability/clipboard";

export function WhatsAppConfirm({ plan }: { plan: WhatsAppConfirmationPlan }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copyMessage(message: string) {
    const ok = await copyTextToClipboard(message);
    setCopied(ok);
    setCopyFailed(!ok);
    if (ok) toast.success("Mensagem copiada. Cole no WhatsApp para enviar.");
    else toast.error("Não foi possível copiar. Selecione o texto abaixo.");
  }

  if (plan.mode === "blocked") {
    return (
      <p role="status" className="rounded-2xl bg-secondary/70 px-4 py-3 text-sm leading-6">
        {plan.guidance}
      </p>
    );
  }

  const message = plan.message;

  return (
    <div className="grid gap-2">
      {plan.mode === "send" ? (
        <Button className="h-12 w-full rounded-full" render={<a href={plan.href} target="_blank" rel="noreferrer" />}>
          <MessageCircle aria-hidden="true" />
          Confirmar pelo WhatsApp
        </Button>
      ) : (
        <p role="status" className="rounded-2xl bg-metric-blush px-4 py-3 text-sm leading-6 text-wine-deep">
          {plan.guidance}
        </p>
      )}
      <Button type="button" variant="outline" className="h-11 w-full rounded-full" onClick={() => void copyMessage(message)}>
        {copied ? "Mensagem copiada" : "Copiar mensagem"}
      </Button>
      {plan.mode === "copy-only" || copyFailed ? (
        <textarea
          readOnly
          value={message}
          aria-label="Mensagem para enviar"
          className="min-h-40 w-full rounded-2xl border border-input bg-background px-3 py-3 text-sm leading-6"
        />
      ) : null}
      <p className="text-xs leading-5 text-muted-foreground">
        O WhatsApp abre com a mensagem pronta. Nada é enviado sozinho e o status do horário não muda.
      </p>
    </div>
  );
}
