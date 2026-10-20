import type { DiscoveryMode, DiscoverySearchInput } from "./contract";

export type DiscoveryUrlState = {
  mode: DiscoveryMode;
  city: string;
  state: string;
  query: string;
};

const MODE_PARAM = {
  nearby: "perto",
  city: "cidade",
  global: "nome",
} as const;

const PARAM_MODE: Record<string, DiscoveryMode> = {
  perto: "nearby",
  cidade: "city",
  nome: "global",
};

function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" ? raw : "";
}

export function discoveryStateFromQuery(input: {
  modo?: string | string[];
  cidade?: string | string[];
  uf?: string | string[];
  q?: string | string[];
}): DiscoveryUrlState {
  const modo = first(input.modo).trim().toLowerCase();
  return {
    mode: PARAM_MODE[modo] ?? "city",
    city: first(input.cidade).trim().slice(0, 80),
    state: first(input.uf).trim().slice(0, 2).toUpperCase(),
    query: first(input.q).trim().slice(0, 100),
  };
}

export function discoveryHref(pathname: string, state: DiscoveryUrlState): string {
  const params = new URLSearchParams();
  if (state.mode !== "city") params.set("modo", MODE_PARAM[state.mode]);
  if (state.mode !== "global" && state.city.trim()) params.set("cidade", state.city.trim());
  if (state.mode !== "global" && /^[A-Z]{2}$/.test(state.state.trim().toUpperCase())) {
    params.set("uf", state.state.trim().toUpperCase());
  }
  if (state.query.trim()) params.set("q", state.query.trim());
  const text = params.toString();
  return text ? `${pathname}?${text}` : pathname;
}

export function discoveryInputFromUrl(state: DiscoveryUrlState): DiscoverySearchInput {
  return {
    mode: state.mode,
    city: state.city,
    state: state.state,
    query: state.query,
  };
}
