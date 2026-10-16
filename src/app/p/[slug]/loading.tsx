export default function PublicProfileLoading() {
  return (
    <div className="agende-bloom mx-auto grid w-full max-w-5xl gap-4 px-4 py-8" role="status" aria-live="polite" aria-label="Carregando o perfil público">
      <span className="sr-only">Carregando o perfil público…</span>
      <div className="h-56 animate-pulse rounded-[2rem] bg-metric-blush sm:h-80" />
      <div className="h-40 animate-pulse rounded-[1.5rem] bg-white ring-1 ring-[#f0e4de]" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 animate-pulse rounded-[1.5rem] bg-white ring-1 ring-[#f0e4de]" />
        <div className="h-28 animate-pulse rounded-[1.5rem] bg-white ring-1 ring-[#f0e4de]" />
      </div>
    </div>
  );
}
