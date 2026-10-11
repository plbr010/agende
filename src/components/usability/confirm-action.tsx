"use client";

import { useEffect, useId, useRef, useState, type ReactElement } from "react";
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
import {
  failConfirm,
  openConfirm,
  requestClose,
  startConfirm,
  succeedConfirm,
  type ConfirmView,
} from "@/components/usability/confirm-state";

const closedView: ConfirmView = { open: false, pending: false, error: null };

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
  trigger: ReactElement;
  onConfirm: () => void | Promise<void>;
}) {
  const [view, setView] = useState<ConfirmView>(closedView);
  const lock = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const errorId = useId();

  useEffect(() => {
    if (view.error) {
      errorRef.current?.focus();
    }
  }, [view.error]);

  async function confirm() {
    const started = startConfirm(view);
    if (!started.accepted || lock.current) return;
    lock.current = true;
    setView(started.view);
    try {
      await onConfirm();
      setView(succeedConfirm());
    } catch (cause) {
      setView((current) => failConfirm(current, cause));
    } finally {
      lock.current = false;
    }
  }

  return (
    <Dialog
      open={view.open}
      onOpenChange={(next) => {
        setView((current) => (next ? openConfirm(current) : requestClose(current)));
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent
        className="sm:max-w-md"
        initialFocus={titleRef}
        showCloseButton={!view.pending}
      >
        <DialogHeader>
          <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {view.error ? (
          <p
            ref={errorRef}
            id={errorId}
            role="alert"
            tabIndex={-1}
            className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive outline-none"
          >
            {view.error}
          </p>
        ) : null}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            variant="destructive"
            className="h-11 w-full"
            disabled={view.pending}
            aria-busy={view.pending}
            aria-describedby={view.error ? errorId : undefined}
            onClick={() => {
              void confirm();
            }}
          >
            {view.pending ? (pendingLabel ?? "Salvando...") : confirmLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled={view.pending}
            onClick={() => setView((current) => requestClose(current))}
          >
            {cancelLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
