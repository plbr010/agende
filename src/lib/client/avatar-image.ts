import sharp from "sharp";

export const AVATAR_INPUT_LIMIT = 5 * 1024 * 1024;
export const AVATAR_OUTPUT_LIMIT = 2 * 1024 * 1024;

export async function normalizeAvatar(bytes: Uint8Array): Promise<Buffer> {
  if (!bytes.length || bytes.length > AVATAR_INPUT_LIMIT) throw new Error("image_size_invalid");
  try {
    const image = sharp(bytes, { failOn: "warning", limitInputPixels: 16_000_000, animated: false });
    const metadata = await image.metadata();
    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) throw new Error("image_invalid");
    if (!metadata.width || !metadata.height || metadata.width < 32 || metadata.height < 32 ||
      metadata.width > 4096 || metadata.height > 4096 || (metadata.pages ?? 1) > 1) throw new Error("image_invalid");
    // Full decode, EXIF orientation, downscale and re-encode; no metadata or original payload survives.
    const output = await image.rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 }).toBuffer();
    if (output.length > AVATAR_OUTPUT_LIMIT) throw new Error("image_size_invalid");
    return output;
  } catch {
    throw new Error("image_invalid");
  }
}
