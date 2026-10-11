"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { managementAction } from "@/lib/modules/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Mutation } from "@/lib/modules/mutations";

export function ManagementForm({
  action,
  label,
  id,
  children,
  confirm,
  idempotent = false,
}: {
  action: Mutation["action"];
  label: string;
  id?: string;
  children?: ReactNode;
  confirm?: string;
  idempotent?: boolean;
}) {
  const key = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bypass = useRef(false);
  const locked = useRef(false);
  const [ask, setAsk] = useState(false);
  const [state, submit, pending] = useActionState(
    async (previous: Awaited<ReturnType<typeof managementAction>>, form: FormData) => {
      if (idempotent) {
        key.current ??= crypto.randomUUID();
        form.set("key", key.current);
      }
      const result = await managementAction(previous, form);
      if (result.success) key.current = null;
      return result;
    },
    {},
  );

  useEffect(() => {
    if (!pending) locked.current = false;
  }, [pending]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!confirm || bypass.current) {
      bypass.current = false;
      return;
    }
    event.preventDefault();
    if (!locked.current) setAsk(true);
  }

  function approve() {
    if (locked.current) return;
    locked.current = true;
    bypass.current = true;
    setAsk(false);
    formRef.current?.requestSubmit();
    if (bypass.current) {
      bypass.current = false;
      locked.current = false;
      setAsk(true);
    }
  }

  return (
    <form ref={formRef} action={submit} onSubmit={onSubmit} className="grid gap-3">
      <input type="hidden" name="action" value={action} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <fieldset disabled={pending} className="grid gap-3">
        {children}
        <Button type="submit" className="h-11" disabled={pending} aria-busy={pending}>
          {pending ? "Salvando…" : label}
        </Button>
      </fieldset>
      <div aria-live="polite">
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? <p className="text-sm text-primary">{state.success}</p> : null}
      </div>
      {confirm ? (
        <Dialog open={ask} onOpenChange={(next) => { if (!pending) setAsk(next); }}>
          <DialogContent className="sm:max-w-md" initialFocus={titleRef} showCloseButton={!pending}>
            <DialogHeader>
              <DialogTitle ref={titleRef} tabIndex={-1} className="text-base leading-snug outline-none">
                {confirm}
              </DialogTitle>
              <DialogDescription>
                Confira antes de continuar. Se voltar, o que você já preencheu continua neste formulário.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button type="button" className="h-11 w-full" onClick={approve}>
                {label}
              </Button>
              <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setAsk(false)}>
                Voltar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </form>
  );
}

export function Field({
  label,
  name,
  value,
  type = "text",
  required = true,
  min,
  max,
  step,
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <input
        className="h-11 w-full rounded-xl border border-input bg-background px-3"
        name={name}
        defaultValue={value}
        type={type}
        required={required}
        min={min}
        max={max}
        step={step}
      />
    </label>
  );
}

export function SelectField({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1 text-sm">
      {label}
      <select className="h-11 w-full rounded-xl border border-input bg-background px-3" name={name} defaultValue={value}>
        {children}
      </select>
    </label>
  );
}

export function ActionPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-2xl border bg-card p-4">
      <summary className="flex min-h-12 cursor-pointer items-center font-medium text-primary">{title}</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
