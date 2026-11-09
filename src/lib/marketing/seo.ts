// Public, indexable pages only. Private areas are excluded in robots.ts.
export const PUBLIC_SITEMAP_PATHS = [
  { path: "/", priority: 1 },
  { path: "/profissionais", priority: 0.9 },
  { path: "/demo", priority: 0.8 },
  { path: "/descobrir", priority: 0.6 },
  { path: "/cadastro", priority: 0.5 },
  { path: "/termos", priority: 0.2 },
  { path: "/privacidade", priority: 0.2 },
] as const;

const PRODUCTION_ORIGIN = "https://agendeapp.online";

export function publicSiteOrigin(env: Record<string, string | undefined> = process.env): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return PRODUCTION_ORIGIN;
  try {
    return new URL(configured).origin;
  } catch {
    return PRODUCTION_ORIGIN;
  }
}
