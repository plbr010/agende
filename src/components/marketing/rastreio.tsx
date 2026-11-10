"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isPageViewPath, pixelEnabled } from "@/lib/marketing/meta-pixel";
import { RASTREIO_SCRIPT_SRC, signupClickDestination } from "@/lib/marketing/rastreio";

type RastreioApi = { track?: (name: string, extra?: Record<string, string>) => unknown };

/**
 * Loads the Rastreio tracker (t.js) into <head> on the first public marketing page
 * a production visitor sees. It reports the full URL, so it is never started on
 * private or token-bearing pages; t.js guards itself against a second run.
 * Clicks that lead to /cadastro are reported as "started checkout" (t.js alone only
 * counts links to other sites), so the panel shows how many visitors went to sign up.
 */
export function Rastreio() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pixelEnabled() || !isPageViewPath(pathname)) return;
    if (document.querySelector(`script[src="${RASTREIO_SCRIPT_SRC}"]`)) return;
    const script = document.createElement("script");
    script.async = true;
    script.src = RASTREIO_SCRIPT_SRC;
    document.head.appendChild(script);
  }, [pathname]);

  useEffect(() => {
    if (!pixelEnabled()) return;
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      const dest = signupClickDestination(link?.getAttribute("href"), window.location.origin);
      if (!dest) return;
      const tracker = (window as unknown as { rastreio?: RastreioApi }).rastreio;
      try {
        tracker?.track?.("InitiateCheckout", { dest });
      } catch {
        // Tracking never blocks the visitor's navigation.
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
