import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "agende-panel flex flex-col gap-5 rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de] sm:flex-row sm:items-end sm:justify-between sm:p-7",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-4">
        {Icon ? (
          <div className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-metric-blush text-wine-deep">
            <Icon className="size-5" aria-hidden="true" />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.18em] text-wine-deep uppercase">{eyebrow}</p>
          <h1 className="mt-1 font-serif text-3xl leading-none tracking-tight text-wine-deep sm:text-4xl">{title}</h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
