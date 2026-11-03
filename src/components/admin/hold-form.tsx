"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setAccountHoldAction, type AdminActionState } from "@/lib/admin/actions";

export function HoldAccountForm({
  subjectType,
  subjectId,
  held,
  name,
  returnTo,
}: {
  subjectType: "user" | "workspace";
  subjectId: string;
  held: boolean;
  name: string;
  returnTo: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(setAccountHoldAction, {} as AdminActionState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={held ? "outline" : "destructive"} />}>
        {held ? "Reativar conta" : "Suspender conta"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{held ? "Reativar conta" : "Suspender conta"}</DialogTitle>
          <DialogDescription>
            {held
              ? `Confirma reativar ${name}? O histórico permanece e o acesso volta a seguir as regras do plano.`
              : `Confirma suspender ${name}? Nada é apagado. Novos agendamentos do estabelecimento ficam bloqueados se a suspensão for do salão.`}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <input type="hidden" name="subjectType" value={subjectType} />
          <input type="hidden" name="subjectId" value={subjectId} />
          <input type="hidden" name="active" value={held ? "false" : "true"} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="grid gap-2">
            <Label htmlFor="hold-reason">{held ? "Nota (opcional)" : "Motivo"}</Label>
            <Textarea id="hold-reason" name="reason" minLength={held ? undefined : 3} maxLength={200} required={!held} />
          </div>
          {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
          {state.success ? <p role="status" className="text-sm text-success">{state.success}</p> : null}
          <DialogFooter>
            <Button type="submit" variant={held ? "default" : "destructive"} disabled={pending}>
              {pending ? "Salvando…" : held ? "Reativar" : "Suspender"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
