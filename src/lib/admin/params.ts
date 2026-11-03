export const ADMIN_PAGE_SIZE = 20;

export function parsePage(value: string | undefined): number {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1;
}

export function clampQuery(value: string | undefined): string | null {
  const query = value?.trim().slice(0, 80) ?? "";
  return query.length > 0 ? query : null;
}

export function optionalFilter(value: string | undefined, allowed: readonly string[]): string | null {
  const normalized = value?.trim() ?? "";
  return allowed.includes(normalized) ? normalized : null;
}

export function listOffset(page: number, pageSize = ADMIN_PAGE_SIZE): number {
  return (page - 1) * pageSize;
}

export function pageCount(total: number, pageSize = ADMIN_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(total, 0) / pageSize));
}

export function withParams(path: string, params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
