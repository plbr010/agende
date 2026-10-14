import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { normalizeAvatar, AVATAR_INPUT_LIMIT } from "./avatar-image";
test("avatars decode JPEG PNG WebP and normalize into bounded metadata-free WebP", async () => {
  for (const format of ["jpeg", "png", "webp"] as const) {
    const input = await sharp({ create: { width: 800, height: 600, channels: 3, background: "red" } }).toFormat(format).toBuffer();
    const metadata = await sharp(await normalizeAvatar(input)).metadata();
    assert.equal(metadata.format, "webp"); assert.equal(metadata.width, 512); assert.equal(metadata.exif, undefined);
  }
});
test("avatars reject SVG executables corruption size and invalid dimensions", async () => {
  for (const bytes of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>'), Buffer.from("MZ executable.jpg"), Buffer.from([255,216,255]), Buffer.alloc(AVATAR_INPUT_LIMIT+1)]) await assert.rejects(normalizeAvatar(bytes));
  for (const width of [1,4100]) await assert.rejects(normalizeAvatar(await sharp({ create: { width, height: 40, channels: 3, background: "red" } }).png().toBuffer()));
});
