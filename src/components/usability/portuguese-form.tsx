"use client";

import type { ComponentProps, MouseEvent } from "react";
import { applyPortugueseValidity } from "@/lib/usability/field-validity";

function syncField(target: EventTarget | null) {
  if (
    (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
    "validity" in target
  ) {
    applyPortugueseValidity(target);
  }
}

function syncForm(form: HTMLFormElement) {
  for (const element of Array.from(form.elements)) {
    syncField(element);
  }
}

export function PortugueseForm({
  onInvalid,
  onInput,
  onClick,
  ...props
}: ComponentProps<"form">) {
  return (
    <form
      {...props}
      onClick={(event: MouseEvent<HTMLFormElement>) => {
        const submitter = (event.target as HTMLElement | null)?.closest("button, input[type=submit]");
        if (submitter && submitter.getAttribute("type") !== "button") {
          syncForm(event.currentTarget);
        }
        onClick?.(event);
      }}
      onInvalid={(event) => {
        syncField(event.target);
        onInvalid?.(event);
      }}
      onInput={(event) => {
        syncField(event.target);
        onInput?.(event);
      }}
    />
  );
}
