import { AVATAR_INPUT_LIMIT } from "@/lib/client/avatar-image";

/** Bounded stream, including chunked requests without Content-Length. */
export async function readImageBody(request: Request): Promise<Uint8Array> {
  if (!request.body || Number(request.headers.get("content-length")) > AVATAR_INPUT_LIMIT) throw new Error("image_size_invalid");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.length;
      if (size > AVATAR_INPUT_LIMIT) { await reader.cancel(); throw new Error("image_size_invalid"); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export const imageHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
