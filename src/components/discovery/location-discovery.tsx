"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MapPin, Navigation, Search, X } from "lucide-react";
import { FavoriteButton } from "@/components/client/favorite-button";
import { EmptyState } from "@/components/app/empty-state";
import { WorkspaceFinder } from "@/components/client/workspace-finder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPublicLocalitiesAction, searchPublicWorkspacesAction } from "@/lib/discovery/actions";
import {
  DISCOVERY_COPY,
  discoveryActiveFilters,
  discoveryEmptyExplanation,
  discoveryHasMorePage,
  discoverySearchBlockedReason,
  discoveryWithoutFilter,
  type DiscoveryFilterKey,
  formatDiscoveryShowingCount,
  mergeDiscoveryPages,
  type DiscoveryCoordinates,
  type DiscoveryLocality,
  type DiscoveryMode,
  type DiscoverySearchInput,
  type DiscoverySearchResult,
  type DiscoveryWorkspaceCard,
} from "@/lib/discovery/contract";
import { discoveryHref, discoveryInputFromUrl, type DiscoveryUrlState } from "@/lib/discovery/url";
import { reverseGeocodeLocality } from "@/lib/discovery/geocode";
import { nextRadioIndex } from "@/lib/usability/roving-radio";
import { publicImageUrl } from "@/lib/workspace/public";
import { BR_STATES, selectClassName } from "@/lib/workspace/labels";
import { cn } from "@/lib/utils";

type NearbyStatus = "idle" | "asking" | "granted" | "denied" | "unsupported" | "city-unknown";

const MODES: { id: DiscoveryMode; label: string }[] = [
  { id: "nearby", label: DISCOVERY_COPY.modeNearby },
  { id: "city", label: DISCOVERY_COPY.modeCity },
  { id: "global", label: DISCOVERY_COPY.modeGlobal },
];

const EMPTY_QUERY: DiscoveryUrlState = { mode: "city", city: "", state: "", query: "" };

export function LocationDiscovery({
  knownWorkspaces = [],
  savedFavorites = {},
  canSaveFavorites = false,
  initialQuery = EMPTY_QUERY,
  initialResult = null,
}: {
  knownWorkspaces?: { slug: string; name: string }[];
  savedFavorites?: Record<string, string>;
  canSaveFavorites?: boolean;
  initialQuery?: DiscoveryUrlState;
  initialResult?: DiscoverySearchResult | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const modeGroupId = useId();
  const [mode, setMode] = useState<DiscoveryMode>(initialQuery.mode);
  const [city, setCity] = useState(initialQuery.city);
  const [state, setState] = useState(initialQuery.state);
  const [query, setQuery] = useState(initialQuery.query);
  const [coordinates, setCoordinates] = useState<DiscoveryCoordinates | undefined>();
  const [nearby, setNearby] = useState<NearbyStatus>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoverySearchResult | null>(initialResult);
  const [pending, setPending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastSearch, setLastSearch] = useState<DiscoverySearchInput | null>(
    initialResult?.status === "ready" ? discoveryInputFromUrl(initialQuery) : null,
  );
  const [suggestions, setSuggestions] = useState<DiscoveryLocality[]>([]);
  const searchLock = useRef(false);
  const searchGeneration = useRef(0);

  function rememberSearch(input: DiscoverySearchInput) {
    router.replace(
      discoveryHref(pathname, {
        mode: input.mode ?? "city",
        city: input.city ?? "",
        state: input.state ?? "",
        query: input.query ?? "",
      }),
      { scroll: false },
    );
  }

  async function executeSearch(input: DiscoverySearchInput) {
    if (searchLock.current) return;
    const blocked = discoverySearchBlockedReason(input);
    if (blocked) {
      setFormError(blocked);
      setResult(null);
      setLastSearch(null);
      return;
    }
    const generation = searchGeneration.current + 1;
    searchGeneration.current = generation;
    setFormError(null);
    searchLock.current = true;
    setPending(true);
    try {
      const next = await searchPublicWorkspacesAction(input);
      if (generation !== searchGeneration.current) return;
      setResult(next);
      setLastSearch(input);
      rememberSearch(input);
    } catch {
      if (generation !== searchGeneration.current) return;
      setResult({ status: "error", message: DISCOVERY_COPY.searchError, items: [] });
      setLastSearch(null);
    } finally {
      if (generation === searchGeneration.current) {
        searchLock.current = false;
        setPending(false);
      }
    }
  }

  useEffect(() => {
    if (mode !== "city" || city.trim().length < 2) {
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void listPublicLocalitiesAction(city, state || undefined)
        .then((items) => {
          if (!cancelled) setSuggestions(items);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [city, state, mode]);

  function applyMode(next: DiscoveryMode) {
    setMode(next);
    setFormError(null);
    setResult(null);
    setLastSearch(null);
    if (next !== "nearby") {
      setCoordinates(undefined);
    }
    router.replace(discoveryHref(pathname, { mode: next, city, state, query }), { scroll: false });
  }

  function clearFilters() {
    searchGeneration.current += 1;
    searchLock.current = false;
    setPending(false);
    setMode("city");
    setCity("");
    setState("");
    setQuery("");
    setCoordinates(undefined);
    setNearby("idle");
    setFormError(null);
    setResult(null);
    setLastSearch(null);
    setSuggestions([]);
    router.replace(pathname, { scroll: false });
  }

  function onModeKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, current: DiscoveryMode) {
    const index = MODES.findIndex((item) => item.id === current);
    const next = nextRadioIndex(index, MODES.length, event.key);
    if (next === null) return;
    event.preventDefault();
    const id = MODES[next]?.id;
    if (!id) return;
    applyMode(id);
    window.requestAnimationFrame(() => {
      document.getElementById(`discovery-mode-${id}`)?.focus();
    });
  }

  function currentSearchInput(offset = 0): DiscoverySearchInput {
    return {
      mode,
      city,
      state,
      query,
      coordinates: mode === "nearby" ? coordinates : undefined,
      offset,
    };
  }

  async function requestNearby() {
    if (!("geolocation" in navigator)) {
      setNearby("unsupported");
      return;
    }
    setNearby("asking");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setCoordinates(next);
        const locality = await reverseGeocodeLocality(next);
        if (locality) {
          setCity(locality.city);
          if (locality.state) setState(locality.state);
          setNearby("granted");
        } else {
          setNearby("city-unknown");
        }
      },
      () => {
        setCoordinates(undefined);
        setNearby("denied");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    if (pending || loadingMore || searchLock.current) return;
    const input = currentSearchInput(0);
    const blocked = discoverySearchBlockedReason(input);
    if (blocked) {
      setFormError(blocked);
      setResult(null);
      setLastSearch(null);
      return;
    }
    await executeSearch(input);
  }

  function searchWholeCity() {
    setQuery("");
    void executeSearch({ mode, city, state, query: "", coordinates: mode === "nearby" ? coordinates : undefined, offset: 0 });
  }

  function removeFilter(key: DiscoveryFilterKey) {
    const base = lastSearch ?? currentSearchInput(0);
    const next = discoveryWithoutFilter(base, key);
    setMode(next.mode ?? "city");
    setCity(next.city ?? "");
    setState(next.state ?? "");
    setQuery(next.query ?? "");
    const blocked = discoverySearchBlockedReason(next);
    if (blocked) {
      searchGeneration.current += 1;
      searchLock.current = false;
      setPending(false);
      setFormError(blocked);
      setResult(null);
      setLastSearch(null);
      rememberSearch(next);
      return;
    }
    void executeSearch(next);
  }

  async function loadMore() {
    if (!lastSearch || !result || result.status !== "ready" || pending || loadingMore || searchLock.current) return;
    if (!discoveryHasMorePage(result.items.length, result.total)) return;
    const generation = searchGeneration.current;
    setFormError(null);
    searchLock.current = true;
    setLoadingMore(true);
    try {
      const next = await searchPublicWorkspacesAction({ ...lastSearch, offset: result.items.length });
      if (generation !== searchGeneration.current) return;
      if (next.status === "ready") {
        if (next.items.length === 0) {
          setResult({ status: "ready", items: result.items, total: result.items.length });
          return;
        }
        setResult({
          status: "ready",
          items: mergeDiscoveryPages(result.items, next.items),
          total: next.total,
        });
        return;
      }
      if (next.status === "error") {
        setFormError(next.message);
        return;
      }
      setFormError(DISCOVERY_COPY.searchError);
    } catch {
      if (generation !== searchGeneration.current) return;
      setFormError(DISCOVERY_COPY.searchError);
    } finally {
      if (generation === searchGeneration.current) {
        searchLock.current = false;
        setLoadingMore(false);
      }
    }
  }

  return (
    <div className="grid gap-6">
      <section className="agende-panel grid gap-5 rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de] sm:p-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-wine-deep uppercase">Onde procurar</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Comece pela cidade. O nome do salão ou da profissional é opcional.
          </p>
          <details className="mt-3 rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-[#f0e4de]">
            <summary className="cursor-pointer text-sm font-medium text-wine-deep">A cidade pode ser qualquer uma</summary>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{DISCOVERY_COPY.scenarioHint}</p>
          </details>
        </div>

        <div role="radiogroup" aria-labelledby={modeGroupId} className="grid gap-2 sm:grid-cols-3">
          <p id={modeGroupId} className="sr-only">
            Como procurar
          </p>
          {MODES.map((item) => (
            <button
              key={item.id}
              id={`discovery-mode-${item.id}`}
              type="button"
              role="radio"
              aria-checked={mode === item.id}
              tabIndex={mode === item.id ? 0 : -1}
              onClick={() => applyMode(item.id)}
              onKeyDown={(event) => onModeKeyDown(event, item.id)}
              className={cn(
                "min-h-11 rounded-full px-4 text-sm font-medium ring-1 ring-[#f0e4de] transition",
                mode === item.id ? "bg-primary text-primary-foreground ring-primary" : "bg-background text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {mode === "nearby" ? (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">Ao usar a localização, o serviço BigDataCloud recebe sua posição aproximada e IP para identificar a cidade. O Agendê recebe somente a cidade e o estado. Você também pode digitá-los abaixo.</p>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-full sm:w-auto"
              onClick={() => void requestNearby()}
              disabled={nearby === "asking"}
            >
              <Navigation className="size-4" aria-hidden="true" />
              {nearby === "asking" ? DISCOVERY_COPY.nearbyLocating : DISCOVERY_COPY.nearbyAsk}
            </Button>
            {nearby === "granted" ? (
              <p role="status" className="rounded-2xl bg-[var(--status-confirmed-bg)] px-4 py-3 text-sm text-[var(--status-confirmed-fg)]">
                {DISCOVERY_COPY.nearbyGranted}
                {city ? ` Procurando em ${city}${state ? `/${state}` : ""}.` : ""}
              </p>
            ) : null}
            {nearby === "denied" ? (
              <p role="status" className="rounded-2xl bg-metric-sand px-4 py-3 text-sm">
                {DISCOVERY_COPY.nearbyDenied}
              </p>
            ) : null}
            {nearby === "unsupported" ? (
              <p role="status" className="rounded-2xl bg-metric-ivory px-4 py-3 text-sm">
                {DISCOVERY_COPY.nearbyUnsupported}
              </p>
            ) : null}
            {nearby === "city-unknown" ? (
              <p role="status" className="rounded-2xl bg-metric-sand px-4 py-3 text-sm">
                {DISCOVERY_COPY.nearbyCityUnknown}
              </p>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={(event) => void runSearch(event)} className="grid gap-4">
          {mode !== "global" ? (
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div className="grid gap-2">
                <Label htmlFor="discovery-city">{DISCOVERY_COPY.cityLabel}</Label>
                <Input
                  id="discovery-city"
                  value={city}
                  onChange={(event) => {
                    setCity(event.target.value);
                    setFormError(null);
                  }}
                  placeholder="Ex.: Muriaé, Juiz de Fora, Recife"
                  autoComplete="address-level2"
                  className="h-11"
                  list="discovery-city-suggestions"
                />
                {mode === "city" && city.trim().length >= 2 && suggestions.length > 0 ? (
                  <datalist id="discovery-city-suggestions">
                    {suggestions.map((item) => (
                      <option key={`${item.city}-${item.state}`} value={item.city}>
                        {item.state ? `${item.city} · ${item.state}` : item.city}
                      </option>
                    ))}
                  </datalist>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="discovery-state">{DISCOVERY_COPY.stateLabel}</Label>
                <select
                  id="discovery-state"
                  value={state}
                  onChange={(event) => setState(event.target.value)}
                  className={selectClassName}
                >
                  <option value="">UF</option>
                  {BR_STATES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="discovery-query">
              {mode === "global" ? DISCOVERY_COPY.queryLabel : DISCOVERY_COPY.queryOptionalLabel}
            </Label>
            <Input
              id="discovery-query"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setFormError(null);
              }}
              placeholder={mode === "global" ? "Ex.: Studio Aurora ou Maria" : "Opcional. Ex.: Maria"}
              autoComplete="off"
              className="h-11"
            />
            <p className="text-sm text-muted-foreground">{DISCOVERY_COPY.queryHint}</p>
          </div>
          {formError ? (
            <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" className="h-12 flex-1 rounded-full" disabled={pending || loadingMore} aria-busy={pending}>
              <Search className="size-4" aria-hidden="true" />
              {pending ? "Procurando..." : DISCOVERY_COPY.submit}
            </Button>
            <Button type="button" variant="outline" className="h-12 rounded-full" disabled={pending || loadingMore} onClick={clearFilters}>
              {DISCOVERY_COPY.clear}
            </Button>
          </div>
        </form>
      </section>

      {lastSearch ? <DiscoveryFilters search={lastSearch} pending={pending || loadingMore} onRemove={removeFilter} /> : null}

      <div aria-live="polite">
        {pending ? (
          <p role="status" className="rounded-[1.5rem] bg-white px-4 py-3 text-sm text-muted-foreground ring-1 ring-[#f0e4de]">
            Procurando estabelecimentos…
          </p>
        ) : null}
        {result?.status === "unavailable" ? (
          <section className="agende-panel rounded-[1.5rem] ring-1 ring-[#f0e4de]">
            <EmptyState
              icon={MapPin}
              title={DISCOVERY_COPY.unavailableTitle}
              description={DISCOVERY_COPY.unavailableBody}
            />
          </section>
        ) : null}

        {result?.status === "error" ? (
          <p role="alert" className="rounded-[1.5rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {result.message}
          </p>
        ) : null}

        {result?.status === "ready" && result.items.length === 0 ? (
          <section className="agende-panel rounded-[1.5rem] ring-1 ring-[#f0e4de]">
            <EmptyState
              icon={MapPin}
              title={DISCOVERY_COPY.emptyTitle}
              description={lastSearch ? discoveryEmptyExplanation(lastSearch) : DISCOVERY_COPY.emptyBody}
              action={
                <div className="flex flex-col gap-2 sm:flex-row">
                  {lastSearch?.query && lastSearch.mode !== "global" && (lastSearch.city?.trim().length ?? 0) >= 2 ? (
                    <Button type="button" variant="outline" className="h-11 rounded-full whitespace-normal" disabled={pending || loadingMore} onClick={searchWholeCity}>
                      {DISCOVERY_COPY.cityWide}
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" className="h-11 rounded-full" disabled={pending || loadingMore} onClick={clearFilters}>
                    {DISCOVERY_COPY.clear}
                  </Button>
                </div>
              }
            />
          </section>
        ) : null}

        {result?.status === "ready" && result.items.length > 0 ? (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              {formatDiscoveryShowingCount(result.items.length, result.total)}
            </p>
            {lastSearch?.query ? (
              <p className="text-sm leading-6 text-muted-foreground">{DISCOVERY_COPY.queryResults}</p>
            ) : null}
            {lastSearch?.query && mode !== "global" && city.trim().length >= 2 ? (
              <Button type="button" variant="outline" className="h-11 w-fit max-w-full rounded-full whitespace-normal" disabled={pending || loadingMore} onClick={searchWholeCity}>
                {DISCOVERY_COPY.cityWide}
              </Button>
            ) : null}
            <ul className="grid gap-3">
              {result.items.map((item) => (
                <DiscoveryResult
                  key={item.slug}
                  item={item}
                  canSaveFavorites={canSaveFavorites}
                  savedWorkspaceId={item.workspaceId ?? savedFavorites[item.slug] ?? null}
                  saved={Boolean(savedFavorites[item.slug])}
                />
              ))}
            </ul>
            {discoveryHasMorePage(result.items.length, result.total) && result.items.length <= 10000 ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full"
                onClick={() => void loadMore()}
                disabled={pending || loadingMore}
                aria-busy={loadingMore}
              >
                {loadingMore ? DISCOVERY_COPY.loadingMore : DISCOVERY_COPY.loadMore}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <section className="agende-panel grid gap-3 rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de] sm:p-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-wine-deep uppercase">Já tem o link?</p>
          <h2 className="mt-1 font-serif text-2xl text-wine-deep">Abrir o salão pelo convite</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Este caminho já funciona. Cole o endereço que chegou no WhatsApp ou Instagram.
          </p>
        </div>
        <WorkspaceFinder knownWorkspaces={knownWorkspaces} />
      </section>
    </div>
  );
}

function DiscoveryFilters({
  search,
  pending,
  onRemove,
}: {
  search: DiscoverySearchInput;
  pending: boolean;
  onRemove: (key: DiscoveryFilterKey) => void;
}) {
  const filters = discoveryActiveFilters(search);
  if (filters.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtros usados">
      <p className="text-sm font-medium text-wine-deep">Filtros</p>
      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm text-wine-deep ring-1 ring-[#f0e4de]"
          disabled={pending}
          onClick={() => onRemove(filter.key)}
        >
          {filter.label}
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Remover {filter.label}</span>
        </button>
      ))}
    </div>
  );
}

function DiscoveryResult({
  item,
  canSaveFavorites,
  savedWorkspaceId,
  saved,
}: {
  item: DiscoveryWorkspaceCard;
  canSaveFavorites: boolean;
  savedWorkspaceId: string | null;
  saved: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const logo = publicImageUrl(item.logoPath);
  const place = [item.city, item.state].filter(Boolean).join(" · ");
  const initial = item.name.slice(0, 1).toUpperCase();

  return (
    <li className="agende-panel grid gap-3 rounded-[1.25rem] p-4 ring-1 ring-[#f0e4de]">
      <a
        href={`/p/${item.slug}`}
        className="flex min-h-16 items-start gap-4 rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {logo && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            onError={() => setFailed(true)}
            className="size-16 shrink-0 rounded-2xl object-cover ring-1 ring-[#f0e4de]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-16 shrink-0 place-items-center rounded-2xl bg-wine-deep font-serif text-2xl text-[var(--cream)]"
          >
            {initial}
          </span>
        )}
        <span className="min-w-0">
          <span className="block font-serif text-xl leading-tight text-wine-deep">{item.name}</span>
          <span className="mt-1 block text-sm text-muted-foreground">{place || "Local informado pelo salão"}</span>
          {item.matchedNames.length > 0 ? (
            <span className="mt-1 block text-sm leading-6 text-foreground">
              {DISCOVERY_COPY.matchedPeople}: {item.matchedNames.join(", ")}
            </span>
          ) : null}
          {item.description ? (
            <span className="mt-1 line-clamp-2 block text-sm leading-6 text-foreground/80">{item.description}</span>
          ) : null}
          <span className="mt-2 inline-flex min-h-8 items-center text-sm font-medium text-wine-deep underline-offset-4">
            {item.bookingOpen ? DISCOVERY_COPY.cardBook : DISCOVERY_COPY.cardProfile}
          </span>
        </span>
      </a>
      {canSaveFavorites ? (
        <FavoriteButton slug={item.slug} workspaceId={savedWorkspaceId} initialSaved={saved} name={item.name} />
      ) : null}
    </li>
  );
}
