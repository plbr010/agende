/**
 * Public discovery of establishments.
 *
 * The UI never invents salons and never injects a city of residence.
 * Coordinates stay on-device until Codex persists coarse points; v1 RPCs
 * receive only city/state/query. Nearby search reverse-geocodes to a city.
 * DISCOVERY_BACKEND_READY stays false until Codex ships the RPCs — the
 * adapter still probes them at runtime and degrades to unavailable.
 */

export const DISCOVERY_BACKEND_READY = false;

export const DISCOVERY_RPCS = {
  listLocalities: "list_public_localities",
  searchWorkspaces: "search_public_workspaces",
} as const;

export const DISCOVERY_PAGE_SIZE = 20;

export type DiscoveryMode = "nearby" | "city" | "global";

export type DiscoveryCoordinates = {
  latitude: number;
  longitude: number;
};

export type DiscoverySearchInput = {
  mode?: DiscoveryMode;
  city?: string;
  state?: string;
  query?: string;
  coordinates?: DiscoveryCoordinates;
  offset?: number;
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

export type DiscoveryLocality = {
  city: string;
  state: string;
  workspaceCount: number;
};

export type DiscoverySearchResult =
  | { status: "ready"; items: DiscoveryWorkspaceCard[]; total: number }
  | { status: "unavailable"; reason: "missing_backend"; items: [] }
  | { status: "error"; message: string; items: [] };

export type DiscoveryRpc = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;

export function roundDiscoveryCoordinate(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 1000) / 1000;
}

export function sanitizeDiscoveryOffset(offset: number | undefined): number {
  if (typeof offset !== "number" || !Number.isFinite(offset) || offset < 0) return 0;
  return Math.min(Math.floor(offset), 10_000);
}

export function mergeDiscoveryPages(
  current: DiscoveryWorkspaceCard[],
  incoming: DiscoveryWorkspaceCard[],
): DiscoveryWorkspaceCard[] {
  const seen = new Set(current.map((item) => item.slug));
  return [...current, ...incoming.filter((item) => !seen.has(item.slug))];
}

export function discoveryHasMorePage(shown: number, total: number): boolean {
  return shown > 0 && total > shown;
}

export function formatDiscoveryShowingCount(shown: number, total: number): string {
  return `Mostrando ${shown} de ${total}`;
}

export function sanitizeDiscoveryCoordinates(
  coordinates: DiscoveryCoordinates | undefined,
): DiscoveryCoordinates | undefined {
  if (!coordinates) return undefined;
  const latitude = roundDiscoveryCoordinate(coordinates.latitude);
  const longitude = roundDiscoveryCoordinate(coordinates.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  return { latitude, longitude };
}

export function normalizeDiscoverySearch(input: DiscoverySearchInput): DiscoverySearchInput {
  const city = input.city?.trim() ?? "";
  const state = input.state?.trim().toUpperCase() ?? "";
  const query = input.query?.trim() ?? "";
  const coordinates = sanitizeDiscoveryCoordinates(input.coordinates);
  const mode: DiscoveryMode =
    input.mode ?? (coordinates && !city ? "nearby" : query && !city ? "global" : "city");

  return {
    mode,
    city: mode !== "global" && city.length >= 2 ? city : undefined,
    state: mode !== "global" && /^[A-Z]{2}$/.test(state) ? state : undefined,
    query: query.length >= 2 ? query : undefined,
    coordinates: mode === "nearby" ? coordinates : undefined,
  };
}

export function discoverySearchNeedsLocality(input: DiscoverySearchInput): boolean {
  const normalized = normalizeDiscoverySearch(input);
  return normalized.mode === "city" && !normalized.city;
}

export function discoverySearchBlockedReason(input: DiscoverySearchInput): string | null {
  const normalized = normalizeDiscoverySearch(input);
  if (normalized.mode === "global") {
    return normalized.query ? null : DISCOVERY_COPY.missingQuery;
  }
  if (normalized.mode === "nearby") {
    if (normalized.city || normalized.coordinates) return null;
    return DISCOVERY_COPY.missingNearby;
  }
  return normalized.city ? null : DISCOVERY_COPY.missingCity;
}

export function isMissingDiscoveryContract(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883") return true;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("could not find the function") ||
    message.includes("schema cache") ||
    message.includes("does not exist")
  );
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

export function parseDiscoveryWorkspaceCard(raw: unknown): DiscoveryWorkspaceCard | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const name = asString(data.name);
  const slug = asString(data.slug);
  if (!name || !slug) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  return {
    name,
    slug,
    description: asString(data.description),
    city: asString(data.city),
    state: asString(data.state)?.toUpperCase() ?? null,
    logoPath: asString(data.logo_path) ?? asString(data.logoPath),
    bookingOpen: asBoolean(data.booking_open) || asBoolean(data.bookingOpen),
  };
}

export function parseDiscoverySearchPayload(raw: unknown): { items: DiscoveryWorkspaceCard[]; total: number } {
  if (!raw || typeof raw !== "object") {
    return { items: [], total: 0 };
  }
  const data = raw as Record<string, unknown>;
  const rows = Array.isArray(data.items) ? data.items : Array.isArray(raw) ? (raw as unknown[]) : [];
  const items = rows.flatMap((row) => {
    const card = parseDiscoveryWorkspaceCard(row);
    return card ? [card] : [];
  });
  const total = asCount(data.total) || items.length;
  return { items, total };
}

export function parseDiscoveryLocalities(raw: unknown): DiscoveryLocality[] {
  if (!raw || typeof raw !== "object") return [];
  const data = raw as Record<string, unknown>;
  const rows = Array.isArray(data.localities) ? data.localities : [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const city = asString(item.city);
    const state = asString(item.state)?.toUpperCase() ?? "";
    if (!city) return [];
    return [
      {
        city,
        state: /^[A-Z]{2}$/.test(state) ? state : "",
        workspaceCount: asCount(item.workspace_count) || asCount(item.workspaceCount),
      },
    ];
  });
}

export function discoveryRpcArgs(input: DiscoverySearchInput): Record<string, unknown> {
  const normalized = normalizeDiscoverySearch(input);
  return {
    p_city: normalized.city ?? null,
    p_state: normalized.state ?? null,
    p_query: normalized.query ?? null,
    p_postal_code: null,
    p_limit: DISCOVERY_PAGE_SIZE,
    p_offset: sanitizeDiscoveryOffset(input.offset),
  };
}

export async function searchPublicWorkspacesWithRpc(
  rpc: DiscoveryRpc,
  input: DiscoverySearchInput,
): Promise<DiscoverySearchResult> {
  const blocked = discoverySearchBlockedReason(input);
  if (blocked) {
    return { status: "error", message: blocked, items: [] };
  }
  const { data, error } = await rpc(DISCOVERY_RPCS.searchWorkspaces, discoveryRpcArgs(input));
  if (isMissingDiscoveryContract(error)) {
    return { status: "unavailable", reason: "missing_backend", items: [] };
  }
  if (error) {
    const message = (error.message ?? "").toLowerCase();
    if (message.includes("city") && !normalizeDiscoverySearch(input).city) {
      return { status: "error", message: DISCOVERY_COPY.cityRequiredByBackend, items: [] };
    }
    return { status: "error", message: DISCOVERY_COPY.searchError, items: [] };
  }
  const parsed = parseDiscoverySearchPayload(data);
  return { status: "ready", items: parsed.items, total: parsed.total };
}

export async function listPublicLocalitiesWithRpc(
  rpc: DiscoveryRpc,
  query: string,
  state?: string,
): Promise<DiscoveryLocality[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];
  const { data, error } = await rpc(DISCOVERY_RPCS.listLocalities, {
    p_state: state && /^[A-Z]{2}$/.test(state) ? state : null,
    p_query: normalizedQuery,
    p_limit: 8,
  });
  if (error || isMissingDiscoveryContract(error)) return [];
  return parseDiscoveryLocalities(data);
}

/**
 * @deprecated Use searchPublicWorkspacesWithRpc / the server action. Kept so
 * existing client imports fail closed with zero invented results.
 */
export async function searchPublicWorkspaces(input: DiscoverySearchInput): Promise<DiscoverySearchResult> {
  normalizeDiscoverySearch(input);
  return { status: "unavailable", reason: "missing_backend", items: [] };
}

export const DISCOVERY_COPY = {
  title: "Encontrar um salão",
  description:
    "Procure perto de onde você está agora, em qualquer cidade do Brasil, ou pelo nome do salão. Não precisa ser a cidade onde você mora. Se o salão já te mandou um link, use-o abaixo — é o jeito que já funciona hoje.",
  scenarioHint:
    "Exemplo: se você mora em Muriaé e está em Juiz de Fora, “Perto de mim” procura em Juiz de Fora. Para ver salões de Muriaé ou de qualquer outra cidade, escolha “Uma cidade” ou busque pelo nome.",
  modeNearby: "Perto de mim",
  modeCity: "Uma cidade",
  modeGlobal: "Nome do salão",
  nearbyAsk: "Usar minha localização",
  nearbyGranted:
    "Usamos só a cidade em que você está agora, neste aparelho. Não usamos a cidade de residência da conta.",
  nearbyDenied: "Tudo bem. Você pode procurar por cidade ou pelo nome do salão, sem usar a localização.",
  nearbyUnsupported: "Este aparelho não informa a posição. Escolha a cidade ou busque pelo nome.",
  nearbyLocating: "Descobrindo a cidade em que você está…",
  nearbyCityUnknown: "Não deu para descobrir a cidade. Digite-a abaixo — pode ser qualquer uma.",
  cityLabel: "Cidade",
  stateLabel: "Estado",
  queryLabel: "Nome do salão ou profissional",
  queryOptionalLabel: "Nome do salão (opcional)",
  submit: "Procurar estabelecimentos",
  loadMore: "Ver mais estabelecimentos",
  loadingMore: "Carregando mais...",
  missingCity: "Escreva a cidade onde você quer procurar. Pode ser qualquer uma.",
  missingQuery: "Digite o nome do salão ou da profissional (pelo menos 2 letras).",
  missingNearby: "Autorize a localização ou escolha uma cidade para continuar.",
  cityRequiredByBackend: "Esta versão da busca ainda precisa de uma cidade. Escolha qualquer uma e tente de novo.",
  searchError: "Não foi possível concluir a busca agora. Tente de novo em instantes.",
  unavailableTitle: "A busca por cidade ainda não está no ar",
  unavailableBody:
    "Ainda não dá para listar salões por cidade, proximidade ou nome. Nada foi inventado nesta tela. Use o link que o salão te mandou. Quando a busca existir, ela mostra estabelecimentos da cidade que você escolher — não só da cidade de residência.",
  emptyTitle: "Nenhum salão nesta busca",
  emptyBody: "Não encontramos estabelecimentos com esses dados. Tente outra cidade, outro nome, ou use o link do salão.",
  bookingOpen: "Agenda aberta",
  bookingClosed: "Perfil público",
} as const;
