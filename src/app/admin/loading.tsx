export default function AdminLoading() {
  return (
    <div className="grid gap-4" role="status" aria-live="polite" aria-label="Carregando painel master">
      <span className="sr-only">Carregando…</span>
      <div className="h-28 animate-pulse rounded-[1.5rem] bg-secondary/80" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-[1.25rem] bg-secondary/70" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-[1.5rem] bg-card ring-1 ring-border/70" />
    </div>
  );
}
