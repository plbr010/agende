"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ACQUISITION_COOKIE, META_PIXEL_ID, acquisitionFromUrl, isPageViewPath, pixelEnabled, type PixelEventName } from "@/lib/marketing/meta-pixel";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown; disablePushState?: boolean };
declare global {
  interface Window { fbq?: Fbq; _fbq?: Fbq }
}

/** Installs Meta's standard loader once, with automatic SPA and click tracking off. */
function ensurePixel(): Fbq | null {
  if (typeof window === "undefined" || !pixelEnabled()) return null;
  if (window.fbq) return window.fbq;
  const fbq: Fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue!.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  fbq.disablePushState = true;
  window.fbq = fbq;
  window._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  fbq("set", "autoConfig", false, META_PIXEL_ID);
  fbq("init", META_PIXEL_ID);
  return fbq;
}

function rememberAcquisition() {
  try {
    if (document.cookie.includes(`${ACQUISITION_COOKIE}=`)) return; // first touch wins
    const acquisition = acquisitionFromUrl(new URL(window.location.href));
    if (!acquisition) return;
    const value = encodeURIComponent(JSON.stringify(acquisition));
    document.cookie = `${ACQUISITION_COOKIE}=${value}; Max-Age=${60 * 60 * 24 * 30}; Path=/; SameSite=Lax; Secure`;
  } catch {
    // Cookies blocked: campaign attribution is best effort.
  }
}

export function MetaPixel() {
  const pathname = usePathname();
  useEffect(() => {
    rememberAcquisition();
    if (!isPageViewPath(pathname)) return;
    ensurePixel()?.("track", "PageView");
  }, [pathname]);
  return null;
}

/** Fires one conversion event per browser for `onceKey`. */
export function PixelEvent({ event, onceKey, value }: { event: PixelEventName; onceKey: string; value?: number }) {
  useEffect(() => {
    const fbq = ensurePixel();
    if (!fbq) return;
    const storageKey = `agende_px_${event}_${onceKey}`;
    try {
      if (window.localStorage.getItem(storageKey)) return;
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Storage blocked: still report, at worst a duplicate.
    }
    fbq("track", event, value ? { value, currency: "BRL" } : {});
  }, [event, onceKey, value]);
  return null;
}
