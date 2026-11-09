// "Rastreio": our own UTMify-style tracker (utmify-propria-base). Its t.js keeps a
// first-party visitor id in the `_rv` cookie (and localStorage), "rv_" + 16 hex.
// Sales are attributed when the Stripe webhook carries that id; the tracker scans
// `client_reference_id` and the session metadata (`vid`, `utm_*`). Agendê keeps
// `client_reference_id` for the workspace id (its own billing webhook binds by it),
// so the visitor id travels in metadata.
import { parseAcquisitionCookie, type Acquisition } from "./meta-pixel";

export const RASTREIO_SCRIPT_SRC = "https://utmify-propria-base.vercel.app/t.js";
export const RASTREIO_VISITOR_COOKIE = "_rv";

const VISITOR_ID = /^rv_[a-f0-9]{16}$/;

export function parseVisitorId(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const value = decodeURIComponent(raw).trim();
    return VISITOR_ID.test(value) ? value : null;
  } catch {
    return null;
  }
}

export type CheckoutAttribution = Acquisition & { vid?: string };

/** Visitor id + first-touch UTMs for the Stripe Checkout metadata; undefined when there is nothing. */
export function checkoutAttribution(cookies: { visitor?: string; acquisition?: string }): CheckoutAttribution | undefined {
  const result: CheckoutAttribution = { ...parseAcquisitionCookie(cookies.acquisition) };
  const vid = parseVisitorId(cookies.visitor);
  if (vid) result.vid = vid;
  return Object.keys(result).length ? result : undefined;
}
