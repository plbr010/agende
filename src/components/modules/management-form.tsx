"use client";
import { useActionState, useRef, type ReactNode } from "react";
import { managementAction } from "@/lib/modules/actions";
import { Button } from "@/components/ui/button";
import type { Mutation } from "@/lib/modules/mutations";
export function ManagementForm({ action, label, id, children, confirm, idempotent = false }: {
    action: Mutation["action"];
    label: string;
    id?: string;
    children?: ReactNode;
    confirm?: string;
    idempotent?: boolean;
}) {
    const key = useRef<string | null>(null);
    const [state, submit, pending] = useActionState(async (previous: Awaited<ReturnType<typeof managementAction>>, form: FormData) => {
        if (idempotent) {
            key.current ??= crypto.randomUUID();
            form.set("key", key.current);
        }
        const result = await managementAction(previous, form);
        if (result.success)
            key.current = null;
        return result;
    }, {});
    return <form action={submit} onSubmit={event => { if (confirm && !window.confirm(confirm))
        event.preventDefault(); }} className="grid gap-3">
    <input type="hidden" name="action" value={action}/>{id && <input type="hidden" name="id" value={id}/>}
    <fieldset disabled={pending} className="grid gap-3">{children}<Button type="submit" className="h-11" disabled={pending}>{pending ? "Salvando…" : label}</Button>
    </fieldset>
    <div aria-live="polite">{state.error && <p className="text-sm text-destructive" role="alert">{state.error}</p>}{state.success && <p className="text-sm text-primary">{state.success}</p>}</div>
  </form>;
}
export function Field({ label, name, value, type = "text", required = true, min, max, step }: {
    label: string;
    name: string;
    value?: string | number;
    type?: string;
    required?: boolean;
    min?: number;
    max?: number;
    step?: string;
}) {
    return <label className="grid gap-1 text-sm">{label}<input className="h-11 w-full rounded-xl border border-input bg-background px-3" name={name} defaultValue={value} type={type} required={required} min={min} max={max} step={step}/>
    </label>;
}
export function SelectField({ label, name, value, children }: {
    label: string;
    name: string;
    value?: string;
    children: ReactNode;
}) {
    return <label className="grid gap-1 text-sm">{label}<select className="h-11 w-full rounded-xl border border-input bg-background px-3" name={name} defaultValue={value}>{children}</select>
    </label>;
}
export function ActionPanel({ title, children }: {
    title: string;
    children: ReactNode;
}) {
    return <details className="rounded-2xl border bg-card p-4">
    <summary className="cursor-pointer font-medium text-primary">{title}</summary>
    <div className="mt-4">{children}</div>
    </details>;
}
