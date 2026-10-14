"use client";

import { useTransition, type ReactNode } from "react";

export function PendingForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  children: (pending: boolean) => ReactNode;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      action={(formData) => {
        if (pending) return;
        startTransition(async () => {
          await action(formData);
        });
      }}
    >
      {children(pending)}
    </form>
  );
}
