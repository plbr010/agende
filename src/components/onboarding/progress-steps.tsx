import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Conta" },
  { id: 2, label: "Salão" },
  { id: 3, label: "Pronto" },
] as const;

export const CLIENT_JOURNEY = [
  { id: 1, label: "Conta" },
  { id: 2, label: "E-mail" },
  { id: 3, label: "Perfil" },
  { id: 4, label: "Descobrir" },
] as const;

export const OWNER_JOURNEY = [
  { id: 1, label: "Conta" },
  { id: 2, label: "E-mail" },
  { id: 3, label: "Plano" },
  { id: 4, label: "Salão" },
  { id: 5, label: "Agenda" },
] as const;

export const PROFESSIONAL_JOURNEY = OWNER_JOURNEY;

export const TEAM_JOURNEY = [
  { id: 1, label: "Convite" },
  { id: 2, label: "Conta" },
  { id: 3, label: "E-mail" },
  { id: 4, label: "Aceitar" },
] as const;

export function JourneySteps({
  steps,
  current,
  className,
  label = "Etapas",
}: {
  steps: readonly { id: number; label: string }[];
  current: number;
  className?: string;
  label?: string;
}) {
  return (
    <ol
      className={cn("grid gap-2", className)}
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      aria-label={label}
    >
      {steps.map((step) => {
        const done = step.id < current;
        const active = step.id === current;
        return (
          <li key={step.id} className="grid gap-1.5 text-center" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "h-1.5 rounded-full",
                active && "bg-primary",
                done && "bg-[var(--rose)]",
                !active && !done && "bg-[#eadfd8]",
              )}
            />
            <span className={cn("text-[0.7rem] font-medium", active ? "text-wine-deep" : "text-muted-foreground")}>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

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
