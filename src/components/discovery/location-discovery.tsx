"use client";

import { useEffect, useId, useState } from "react";
import { MapPin, Navigation, Search } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { WorkspaceFinder } from "@/components/client/workspace-finder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPublicLocalitiesAction, searchPublicWorkspacesAction } from "@/lib/discovery/actions";
import {
  DISCOVERY_COPY,
  discoverySearchBlockedReason,
  type DiscoveryCoordinates,
  type DiscoveryLocality,
  type DiscoveryMode,
  type DiscoverySearchResult,
  type DiscoverySearchInput,
} from "@/lib/discovery/contract";
import { reverseGeocodeLocality } from "@/lib/discovery/geocode";
import { BR_STATES, selectClassName } from "@/lib/workspace/labels";
import { cn } from "@/lib/utils";

type NearbyStatus = "idle" | "asking" | "granted" | "denied" | "unsupported" | "city-unknown";

const MODES: { id: DiscoveryMode; label: string }[] = [
  { id: "nearby", label: DISCOVERY_COPY.modeNearby },
  { id: "city", label: DISCOVERY_COPY.modeCity },
  { id: "global", label: DISCOVERY_COPY.modeGlobal },
];

export function LocationDiscovery({
  knownWorkspaces = [],
}: {
  knownWorkspaces?: { slug: string; name: string }[];
}) {
  const modeGroupId = useId();
  const [mode, setMode] = useState<DiscoveryMode>("city");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [query, setQuery] = useState("");
  const [coordinates, setCoordinates] = useState<DiscoveryCoordinates | undefined>();
  const [nearby, setNearby] = useState<NearbyStatus>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoverySearchResult | null>(null);
  const [pending, setPending] = useState(false);
  const [suggestions, setSuggestions] = useState<DiscoveryLocality[]>([]);
  const [searchedInput, setSearchedInput] = useState<DiscoverySearchInput | null>(null);

  useEffect(() => {
    if (mode !== "city" || city.trim().length < 2) {
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void listPublicLocalitiesAction(city, state || undefined).then((items) => {
        if (!cancelled) setSuggestions(items);
      }).catch(() => { if (!cancelled) setSuggestions([]); });
    }, 300);
    return () => { cancelled = true; window.clearTimeout(handle); };
  }, [city, state, mode]);

  function applyMode(next: DiscoveryMode) {
    setMode(next);
    setFormError(null);
    setResult(null);
    if (next !== "nearby") {
      setCoordinates(undefined);
    }
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
    const input = {
      mode,
      city,
      state,
      query,
      coordinates: mode === "nearby" ? coordinates : undefined,
    };
    const blocked = discoverySearchBlockedReason(input);
    if (blocked) {
      setFormError(blocked);
      setResult(null);
      return;
    }
    setFormError(null);
    setSearchedInput(input);
    setPending(true);
    try {
      setResult(await searchPublicWorkspacesAction(input));
    } catch {
      setResult({ status: "error", message: DISCOVERY_COPY.searchError, items: [] });
    } finally {
      setPending(false);
    }
  }

  async function loadMore() {
    if (!searchedInput || result?.status !== "ready" || pending) return;
    setPending(true);
    try {
      const next = await searchPublicWorkspacesAction({ ...searchedInput, offset: result.items.length });
      if (next.status === "ready") {
        const cards = new Map([...result.items, ...next.items].map((item) => [item.slug, item]));
        setResult({ ...next, items: [...cards.values()] });
      } else setFormError(DISCOVERY_COPY.searchError);
    } catch { setFormError(DISCOVERY_COPY.searchError); }
    finally { setPending(false); }
  }

  return (
    <div className="grid gap-6">
      <section className="agende-panel grid gap-5 rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de] sm:p-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-wine-deep uppercase">Onde procurar</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Perto de você, em qualquer cidade, ou pelo nome. A busca nunca fica presa à cidade de residência.
          </p>
        </div>

        <div role="radiogroup" aria-labelledby={modeGroupId} className="grid gap-2 sm:grid-cols-3">
          <p id={modeGroupId} className="sr-only">
            Como procurar
          </p>
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={mode === item.id}
              onClick={() => applyMode(item.id)}
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
                  placeholder="Ex.: Recife, Curitiba, Juiz de Fora"
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
              placeholder={mode === "global" ? "Ex.: Studio Aurora, Maria" : "Se souber o nome"}
              autoComplete="off"
              className="h-11"
            />
          </div>
          {formError ? (
            <p role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <Button type="submit" className="h-12 rounded-full" disabled={pending}>
            <Search className="size-4" aria-hidden="true" />
            {pending ? "Procurando..." : DISCOVERY_COPY.submit}
          </Button>
        </form>
      </section>

      <div aria-live="polite">
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
            <EmptyState icon={MapPin} title={DISCOVERY_COPY.emptyTitle} description={DISCOVERY_COPY.emptyBody} />
          </section>
        ) : null}

        {result?.status === "ready" && result.items.length > 0 ? (
          <><ul className="grid gap-3">
            {result.items.map((item) => (
              <li key={item.slug}>
                <a
                  href={`/p/${item.slug}`}
                  className="agende-panel flex min-h-16 flex-col rounded-[1.25rem] p-4 ring-1 ring-[#f0e4de] transition hover:ring-primary"
                >
                  <p className="font-serif text-xl text-wine-deep">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[item.city, item.state].filter(Boolean).join(" · ") || "Localidade cadastrada"}
                  </p>
                  <p className="mt-1 text-xs font-medium text-wine-deep">
                    {item.bookingOpen ? DISCOVERY_COPY.bookingOpen : DISCOVERY_COPY.bookingClosed}
                  </p>
                </a>
              </li>
            ))}
          </ul>
          {result.items.length < result.total && result.items.length < 10000 ? <Button type="button" onClick={loadMore} disabled={pending} className="mt-3">{pending ? "Carregando..." : "Mostrar mais salões"}</Button> : null}</>
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
