import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center gap-3 px-4 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-metric-blush text-wine-deep">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div>
        <p className="font-serif text-xl text-wine-deep">{title}</p>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
