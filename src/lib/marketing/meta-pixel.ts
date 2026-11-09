// Meta Pixel for the Agendê ad account. The ID is public by design (it ships
// in every page that loads the pixel); it is not a secret.
export const META_PIXEL_ID = "979987648024113";

export type PixelEventName = "CompleteRegistration" | "StartTrial" | "Subscribe";

/** Only the production deployment reports to Meta; previews and local builds never do. */
export function pixelEnabled(deploymentEnv: string | undefined = process.env.NEXT_PUBLIC_AGENDE_DEPLOYMENT_ENV): boolean {
  return deploymentEnv === "production";
}

// Marketing pages only. Private areas, salon booking pages of our customers and
// any URL that can carry a token (invites, auth callbacks, password reset) are
// never reported as page views.
const PAGE_VIEW_PATHS = ["/", "/profissionais", "/descobrir", "/cadastro", "/login", "/comecar", "/termos", "/privacidade", "/verificar-email"];

export function isPageViewPath(pathname: string): boolean {
  if (PAGE_VIEW_PATHS.includes(pathname)) return true;
  return pathname === "/demo" || pathname.startsWith("/demo/");
}

export const ACQUISITION_COOKIE = "agende_acq";
const ACQUISITION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type Acquisition = Partial<Record<(typeof ACQUISITION_KEYS)[number] | "landing", string>>;

const SAFE_VALUE = /^[\p{L}\p{N} ._\-+|:/]{1,100}$/u;

/** First-touch campaign parameters from a landing URL; null when there are none. */
export function acquisitionFromUrl(url: URL): Acquisition | null {
  const result: Acquisition = {};
  for (const key of ACQUISITION_KEYS) {
    const value = url.searchParams.get(key)?.trim();
    if (value && SAFE_VALUE.test(value)) result[key] = value;
  }
  if (Object.keys(result).length === 0) return null;
  if (isPageViewPath(url.pathname)) result.landing = url.pathname;
  return result;
}

/** Parses the acquisition cookie defensively; anything unexpected is dropped. */
export function parseAcquisitionCookie(raw: string | undefined): Acquisition | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (!parsed || typeof parsed !== "object") return null;
    const result: Acquisition = {};
    for (const key of [...ACQUISITION_KEYS, "landing"] as const) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "string" && SAFE_VALUE.test(value)) result[key] = value;
    }
    return Object.keys(result).length ? result : null;
  } catch {
    return null;
  }
}
