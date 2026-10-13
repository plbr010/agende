"use client";

import { useState } from "react";
import { MapPin, Navigation, Search } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { WorkspaceFinder } from "@/components/client/workspace-finder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DISCOVERY_COPY,
  discoverySearchNeedsLocality,
  searchPublicWorkspaces,
  type DiscoveryCoordinates,
  type DiscoverySearchResult,
} from "@/lib/discovery/contract";
import { BR_STATES, selectClassName } from "@/lib/workspace/labels";

type NearbyStatus = "idle" | "asking" | "granted" | "denied" | "unsupported";

export function LocationDiscovery({
  knownWorkspaces = [],
}: {
  knownWorkspaces?: { slug: string; name: string }[];
}) {
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [query, setQuery] = useState("");
  const [coordinates, setCoordinates] = useState<DiscoveryCoordinates | undefined>();
  const [nearby, setNearby] = useState<NearbyStatus>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoverySearchResult | null>(null);
  const [pending, setPending] = useState(false);

  function requestNearby() {
    if (!("geolocation" in navigator)) {
      setNearby("unsupported");
      return;
    }
    setNearby("asking");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setNearby("granted");
      },
      () => {
        setCoordinates(undefined);
        setNearby("denied");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  async function onSearch(event: React.FormEvent) {
    event.preventDefault();
    const input = { city, state, query, coordinates };
    if (discoverySearchNeedsLocality(input)) {
      setFormError(DISCOVERY_COPY.missingCity);
      setResult(null);
      return;
    }
    setFormError(null);
    setPending(true);
    try {
      setResult(await searchPublicWorkspaces(input));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="agende-panel grid gap-5 rounded-[1.5rem] p-5 ring-1 ring-[#f0e4de] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-wine-deep uppercase">Onde procurar</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Toque em usar localização se quiser sugestões perto de você depois. A busca nunca fica presa à cidade de residência.
            </p>
          </div>
          <Button type="button" variant="outline" className="h-11 rounded-full" onClick={requestNearby} disabled={nearby === "asking"}>
            <Navigation className="size-4" aria-hidden="true" />
            {nearby === "asking" ? "Pedindo permissão..." : DISCOVERY_COPY.nearbyAsk}
          </Button>
        </div>
        {nearby === "granted" ? (
          <p role="status" className="rounded-2xl bg-[var(--status-confirmed-bg)] px-4 py-3 text-sm text-[var(--status-confirmed-fg)]">
            {DISCOVERY_COPY.nearbyGranted}
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

        <form onSubmit={onSearch} className="grid gap-4">
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
              />
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
          <div className="grid gap-2">
            <Label htmlFor="discovery-query">{DISCOVERY_COPY.queryLabel}</Label>
            <Input
              id="discovery-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Se souber o nome"
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

      {result?.status === "unavailable" ? (
        <section className="agende-panel rounded-[1.5rem] ring-1 ring-[#f0e4de]">
          <EmptyState
            icon={MapPin}
            title={DISCOVERY_COPY.unavailableTitle}
            description={DISCOVERY_COPY.unavailableBody}
          />
        </section>
      ) : null}

      {result?.status === "ready" && result.items.length === 0 ? (
        <section className="agende-panel rounded-[1.5rem] ring-1 ring-[#f0e4de]">
          <EmptyState
            icon={MapPin}
            title="Nenhum salão nesta busca"
            description="Não encontramos estabelecimentos com esses dados. Tente outra cidade ou use o link do salão."
          />
        </section>
      ) : null}

      {result?.status === "ready" && result.items.length > 0 ? (
        <ul className="grid gap-3">
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
              </a>
            </li>
          ))}
        </ul>
      ) : null}

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
