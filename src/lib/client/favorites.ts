const WORKSPACE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WorkspaceFavorite = {
  workspaceId: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  logoPath: string | null;
};

export type FavoritesView = {
  status: "ready" | "error";
  items: WorkspaceFavorite[];
};

export const FAVORITES_COPY = {
  emptyTitle: "Nenhum salão guardado",
  emptyBody: "Quando você guardar um salão, ele aparece aqui para você abrir de novo com facilidade.",
  errorTitle: "Não foi possível carregar seus favoritos",
  errorBody: "Atualize a página para tentar de novo. Nada foi apagado da sua conta.",
  saved: "Salão guardado.",
  removed: "Salão removido dos favoritos.",
  saveFailed: "Não foi possível guardar este salão agora. Tente de novo.",
  removeFailed: "Não foi possível remover agora. Tente de novo.",
  unavailable: "Este salão não pode ser guardado agora.",
  missingTarget: "Ainda não dá para guardar este salão por aqui.",
} as const;

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** Only a workspace id explicitly returned by a public payload. Never derived from a slug. */
export function readPublicWorkspaceId(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const value = (raw as Record<string, unknown>).workspace_id;
  return typeof value === "string" && WORKSPACE_ID.test(value) ? value : null;
}

export function parseWorkspaceFavorites(raw: unknown): { items: WorkspaceFavorite[]; total: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.items) || typeof data.total !== "number" || !Number.isFinite(data.total)) return null;
  const items: WorkspaceFavorite[] = [];
  for (const item of data.items) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const workspaceId = asText(row.workspace_id);
    const name = asText(row.name);
    const slug = asText(row.slug);
    const city = asText(row.city);
    const state = asText(row.state);
    if (!workspaceId || !WORKSPACE_ID.test(workspaceId) || !name || !slug || !city || !state) return null;
    items.push({
      workspaceId,
      name,
      slug,
      city,
      state,
      logoPath: asText(row.logo_path),
    });
  }
  return { items, total: data.total };
}

export function favoritesViewFromLoad(result: { data: unknown; error: string | null }): FavoritesView {
  if (result.error) return { status: "error", items: [] };
  const parsed = parseWorkspaceFavorites(result.data);
  if (!parsed) return { status: "error", items: [] };
  return { status: "ready", items: parsed.items };
}

export function favoriteActionMessage(error: string): string {
  if (error === "workspace_unavailable") return FAVORITES_COPY.unavailable;
  if (error === "missing_target") return FAVORITES_COPY.missingTarget;
  if (error === "invalid_input") return FAVORITES_COPY.saveFailed;
  return FAVORITES_COPY.saveFailed;
}
