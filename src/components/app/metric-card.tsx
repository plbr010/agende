import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "neutral";
}) {
  const wash = {
    primary: "bg-metric-blush",
    success: "bg-[var(--status-confirmed-bg)]",
    warning: "bg-metric-sand",
    neutral: "bg-metric-ivory",
  }[tone];

  return (
    <article className={cn("flex min-h-32 min-w-0 flex-col rounded-[1.25rem] p-4 shadow-[0_18px_40px_-30px_rgba(92,26,46,0.5)] ring-1 ring-white/80", wash)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-white/80 text-wine-deep">
          <Icon className="size-3.5" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 font-serif text-3xl leading-none tracking-tight break-words text-wine-deep sm:text-4xl">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>
    </article>
  );
}
