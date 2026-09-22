import type { LucideIcon } from "lucide-react";
import { Check, LockKeyhole } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EmptyModuleState({
  icon: Icon,
  title,
  description,
  capabilities,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  capabilities: string[];
}) {
  return (
    <Card className="rounded-3xl border-border/70 bg-card/85 shadow-sm">
      <CardHeader className="items-center px-6 pt-9 text-center">
        <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="size-6" aria-hidden="true" />
        </div>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription className="max-w-xl leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="mx-auto grid w-full max-w-2xl gap-3 px-6 pb-9 sm:grid-cols-2">
        {capabilities.map((capability) => (
          <div key={capability} className="flex items-start gap-3 rounded-2xl bg-secondary/55 p-4 text-sm">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="size-3" aria-hidden="true" />
            </span>
            <span>{capability}</span>
          </div>
        ))}
        <p className="col-span-full mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <LockKeyhole className="size-3.5" /> Controles de escrita permanecem bloqueados até validar o schema remoto.
        </p>
      </CardContent>
    </Card>
  );
}
