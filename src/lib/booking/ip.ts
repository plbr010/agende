import { createHash } from "node:crypto";
import { headers } from "next/headers";

export async function hashClientIp(): Promise<string | null> {
  const hdrs = await headers();
  const forwarded = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || hdrs.get("x-real-ip")?.trim() || null;
  if (!ip) {
    return null;
  }
  return createHash("sha256").update(ip).digest("hex");
}
