export default function OnboardingLoading() {
  return (
    <div className="agende-bloom min-h-full px-4 py-8" role="status" aria-live="polite" aria-label="Carregando onboarding">
      <span className="sr-only">Carregando…</span>
      <div className="mx-auto grid w-full max-w-lg gap-6">
        <div className="h-8 w-32 animate-pulse rounded-full bg-secondary" />
        <div className="h-16 animate-pulse rounded-3xl bg-secondary/80" />
        <div className="h-72 animate-pulse rounded-[2rem] bg-card ring-1 ring-border/70" />
      </div>
    </div>
  );
}
