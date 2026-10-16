export default function ServicesLoading() {
  return (
    <div className="grid gap-4" role="status" aria-live="polite" aria-label="Carregando serviços">
      <span className="sr-only">Carregando serviços…</span>
      <div className="h-28 animate-pulse rounded-[1.5rem] bg-white ring-1 ring-[#f0e4de]" />
      <div className="h-24 animate-pulse rounded-[1.5rem] bg-metric-blush" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-44 animate-pulse rounded-[1.6rem] bg-white ring-1 ring-[#f0e4de]" />
        <div className="h-44 animate-pulse rounded-[1.6rem] bg-white ring-1 ring-[#f0e4de]" />
      </div>
    </div>
  );
}
