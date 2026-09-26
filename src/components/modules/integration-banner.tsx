import { CloudCog, ShieldCheck } from "lucide-react";

export function IntegrationBanner({
  title = "Disponível em breve",
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <aside className="relative overflow-hidden rounded-3xl border border-accent/35 bg-accent/10 p-5 sm:p-6">
      <div className="pointer-events-none absolute -top-16 -right-12 size-40 rounded-full bg-accent/20 blur-3xl" />
      <div className="relative flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-background/80 text-primary ring-1 ring-border">
          <CloudCog className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-primary">
            <ShieldCheck className="size-3.5" /> Estamos preparando esta novidade para seu negócio.
          </p>
        </div>
      </div>
    </aside>
  );
}
