export default function AuthLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-label="Carregando">
      <span className="sr-only">Carregando…</span>
      <div className="h-10 w-40 animate-pulse rounded-2xl bg-secondary" />
      <div className="h-24 animate-pulse rounded-3xl bg-secondary/80" />
      <div className="h-48 animate-pulse rounded-3xl bg-card ring-1 ring-border/70" />
    </div>
  );
}
