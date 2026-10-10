"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmAction({
  title,
  description,
  confirmLabel,
  cancelLabel = "Voltar",
  pendingLabel,
  trigger,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  pendingLabel?: string;
  trigger: ReactNode;
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <>
      <span
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {trigger}
      </span>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              variant="destructive"
              className="h-11 w-full"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? (pendingLabel ?? "Salvando...") : confirmLabel}
            </Button>
            <Button type="button" variant="outline" className="h-11 w-full" disabled={pending} onClick={() => setOpen(false)}>
              {cancelLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
