/**
 * Public discovery of establishments.
 *
 * The UI never invents salons. Until Codex ships the RPCs below, search
 * returns `unavailable` with an empty list — not mock businesses, and not a
 * list limited to the person's city of residence.
 */

export const DISCOVERY_BACKEND_READY = false;

export const DISCOVERY_RPCS = {
  listLocalities: "list_public_localities",
  searchWorkspaces: "search_public_workspaces",
} as const;

export type DiscoveryCoordinates = {
  latitude: number;
  longitude: number;
};

export type DiscoverySearchInput = {
  city?: string;
  state?: string;
  query?: string;
  coordinates?: DiscoveryCoordinates;
};

export type DiscoveryWorkspaceCard = {
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  state: string | null;
  logoPath: string | null;
  bookingOpen: boolean;
};

export type DiscoverySearchResult =
  | { status: "ready"; items: DiscoveryWorkspaceCard[]; total: number }
  | { status: "unavailable"; reason: "missing_backend"; items: [] };

export function normalizeDiscoverySearch(input: DiscoverySearchInput): DiscoverySearchInput {
  const city = input.city?.trim() ?? "";
  const state = input.state?.trim().toUpperCase() ?? "";
  const query = input.query?.trim() ?? "";

  return {
    city: city.length >= 2 ? city : undefined,
    state: /^[A-Z]{2}$/.test(state) ? state : undefined,
    query: query || undefined,
    coordinates: input.coordinates,
  };
}

export function discoverySearchNeedsLocality(input: DiscoverySearchInput): boolean {
  const normalized = normalizeDiscoverySearch(input);
  return !normalized.city;
}

/**
 * Front-end search entry. Does not read a residence city, does not call
 * PostgREST tables (RLS blocks them), and does not fabricate results.
 */
export async function searchPublicWorkspaces(
  input: DiscoverySearchInput,
): Promise<DiscoverySearchResult> {
  normalizeDiscoverySearch(input);
  if (!DISCOVERY_BACKEND_READY) {
    return { status: "unavailable", reason: "missing_backend", items: [] };
  }
  return { status: "unavailable", reason: "missing_backend", items: [] };
}

export const DISCOVERY_COPY = {
  title: "Encontrar um salão",
  description:
    "Escolha qualquer cidade do Brasil. Não precisa ser a cidade onde você mora. Se o salão já te mandou um link, use-o abaixo — é o jeito que já funciona hoje.",
  nearbyAsk: "Sugerir salões perto de mim",
  nearbyGranted:
    "Guardamos sua posição só neste aparelho, para sugerir negócios próximos quando a busca estiver no ar. Enquanto isso, escolha qualquer cidade — não só a sua.",
  nearbyDenied:
    "Tudo bem. Você pode procurar em qualquer cidade sem usar a localização.",
  nearbyUnsupported: "Este aparelho não informa a posição. Escolha a cidade na lista.",
  cityLabel: "Cidade",
  stateLabel: "Estado",
  queryLabel: "Nome do salão (opcional)",
  submit: "Procurar estabelecimentos",
  missingCity: "Escreva a cidade onde você quer procurar. Pode ser qualquer uma.",
  unavailableTitle: "A busca por cidade ainda não está no ar",
  unavailableBody:
    "Ainda não dá para listar salões por cidade ou por proximidade. Nada foi inventado nesta tela. Use o link que o salão te mandou. Quando a busca existir, ela vai mostrar estabelecimentos da cidade que você escolher — não só da cidade de residência.",
} as const;
