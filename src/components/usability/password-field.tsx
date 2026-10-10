"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_HINT } from "@/lib/usability/copy";

export function PasswordField({
  id,
  name,
  label,
  autoComplete,
  error,
  hint = PASSWORD_HINT,
  required = true,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  error?: string;
  hint?: string | null;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          className="h-11 pr-24"
          aria-invalid={Boolean(error)}
          aria-describedby={hint ? `${id}-hint` : error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          className="absolute top-1/2 right-1 inline-flex h-10 min-w-20 -translate-y-1/2 items-center justify-center rounded-lg px-2 text-sm font-medium text-primary"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
