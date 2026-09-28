export function safeRequestOrigin(candidate: string | null, configured: string, previewHosts: string[] = []): string {
  const base = new URL(configured).origin;
  const allowed = new Set([base, ...previewHosts.filter(Boolean).map(host => new URL(`https://${host}`).origin)]);
  try {
    const url = new URL(candidate ?? base);
    return allowed.has(url.origin) && !url.username && !url.password ? url.origin : base;
  } catch { return base; }
}
