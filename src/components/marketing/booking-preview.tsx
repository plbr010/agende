export function BookingPreview() {
  return (
    <div className="relative mx-auto w-full min-w-0 max-w-[22rem] lg:max-w-none">
      <div className="pointer-events-none absolute top-8 left-4 size-28 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute right-2 bottom-6 size-32 rounded-full bg-accent/25 blur-3xl" />

      <div className="relative grid min-w-0 gap-3 sm:grid-cols-[1fr_0.85fr] sm:items-end lg:grid-cols-1 xl:grid-cols-[1fr_0.9fr]">
        <div className="relative mx-auto w-full max-w-[19rem] overflow-hidden rounded-[1.85rem] bg-card/95 p-3 shadow-[0_30px_70px_-36px_oklch(0.38_0.05_25/0.5)] ring-1 ring-border">
          <div className="rounded-[1.4rem] bg-muted/70 px-4 pt-3 pb-4">
            <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-foreground/10" />
            <p className="text-[0.65rem] tracking-[0.18em] text-muted-foreground uppercase">
              Link público
            </p>
            <p className="mt-1 truncate font-serif text-xl text-foreground">
              Estúdio Luna
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              agende.app/estudio-luna
            </p>

            <div className="mt-4 space-y-2">
              <PreviewRow label="Serviço" value="Alongamento em gel" />
              <PreviewRow label="Profissional" value="Marina" />
              <PreviewRow label="Horário" value="Ter 18 · 14:30" accent />
            </div>

            <div className="mt-4 rounded-2xl bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground">
              Confirmar horário
            </div>
          </div>
        </div>

        <div className="relative min-w-0 space-y-3 sm:mb-6 xl:mb-10">
          <div className="rounded-3xl bg-card/90 p-4 shadow-[0_18px_40px_-28px_oklch(0.4_0.05_25/0.45)] ring-1 ring-border">
            <p className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">
              Agenda do dia
            </p>
            <div className="mt-3 space-y-2">
              <AgendaChip time="09:00" name="Ana · manicure" />
              <AgendaChip time="11:30" name="Bianca · lash" />
              <AgendaChip time="14:30" name="Carla · gel" highlight />
              <AgendaChip time="16:00" name="Livre" muted />
            </div>
          </div>
          <div className="rounded-3xl bg-secondary/80 p-4 ring-1 ring-border/80">
            <p className="font-serif text-lg leading-snug text-foreground">
              Elas marcam. Você atende.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sem vai-e-volta no chat para achar um horário.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-accent/40 px-3 py-2.5 ring-1 ring-accent/50"
          : "flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-background/80 px-3 py-2.5"
      }
    >
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function AgendaChip({
  time,
  name,
  highlight = false,
  muted = false,
}: {
  time: string;
  name: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "flex min-w-0 items-center gap-3 rounded-2xl bg-primary/10 px-3 py-2 ring-1 ring-primary/20"
          : "flex min-w-0 items-center gap-3 rounded-2xl bg-background/80 px-3 py-2"
      }
    >
      <span className="w-12 shrink-0 text-xs font-medium text-primary">{time}</span>
      <span
        className={
          muted
            ? "truncate text-sm text-muted-foreground"
            : "truncate text-sm text-foreground"
        }
      >
        {name}
      </span>
    </div>
  );
}
