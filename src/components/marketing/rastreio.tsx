"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isPageViewPath, pixelEnabled } from "@/lib/marketing/meta-pixel";
import { RASTREIO_SCRIPT_SRC } from "@/lib/marketing/rastreio";

/**
 * Loads the Rastreio tracker (t.js) into <head> on the first public marketing page
 * a production visitor sees. It reports the full URL, so it is never started on
 * private or token-bearing pages; t.js guards itself against a second run.
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
  return null;
}
