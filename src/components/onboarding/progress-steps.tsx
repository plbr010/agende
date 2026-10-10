import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Conta" },
  { id: 2, label: "Negócio" },
  { id: 3, label: "Agenda" },
] as const;

export function OnboardingProgressSteps({
  current,
  className,
}: {
  current: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <ol className={cn("grid grid-cols-3 gap-2 text-center text-xs", className)} aria-label="Passos do onboarding">
      {STEPS.map((step) => {
        const done = step.id < current;
        const active = step.id === current;
        return (
          <li
            key={step.id}
            className={cn(
              "rounded-full px-2 py-2 font-medium",
              active && "bg-primary text-primary-foreground",
              done && "bg-secondary text-foreground",
              !active && !done && "bg-secondary/60 text-muted-foreground",
            )}
            aria-current={active ? "step" : undefined}
          >
            {step.id}. {step.label}
          </li>
        );
      })}
    </ol>
  );
}
