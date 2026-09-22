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
  const toneClass = {
    primary: "bg-primary/10 text-primary ring-primary/15",
    success: "bg-success/15 text-success-foreground ring-success/20",
    warning: "bg-warning/20 text-warning-foreground ring-warning/25",
    neutral: "bg-secondary text-secondary-foreground ring-border",
  }[tone];

  return (
    <article className="rounded-3xl border border-border/70 bg-card/85 p-5 shadow-sm shadow-primary/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-3 font-serif text-4xl leading-none font-semibold tracking-tight">{value}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>
        </div>
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl ring-1", toneClass)}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}
