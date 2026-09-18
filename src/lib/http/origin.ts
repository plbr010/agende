import { headers } from "next/headers";
import { getSiteUrl } from "@/lib/supabase/env";

export async function getRequestOrigin(): Promise<string> {
  const hdrs = await headers();
  const forwardedHost = hdrs.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    return `${proto}://${forwardedHost}`;
  }
  return hdrs.get("origin") ?? getSiteUrl();
}

export function hostFromOrigin(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}
