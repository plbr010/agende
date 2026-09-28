import { headers } from "next/headers";
import { getSiteUrl } from "@/lib/supabase/env";
import { safeRequestOrigin } from "@/lib/http/safe-origin";

export async function getRequestOrigin(): Promise<string> {
  const hdrs = await headers();
  const forwardedHost = hdrs.get("x-forwarded-host");
  const candidate = forwardedHost ? `${hdrs.get("x-forwarded-proto") ?? "https"}://${forwardedHost}` : hdrs.get("origin");
  return safeRequestOrigin(candidate, getSiteUrl(), [process.env.VERCEL_URL ?? "", process.env.VERCEL_BRANCH_URL ?? ""]);
}

export function hostFromOrigin(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}
