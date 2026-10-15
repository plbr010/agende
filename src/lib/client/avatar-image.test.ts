import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { normalizeAvatar, normalizeRasterImage, AVATAR_INPUT_LIMIT } from "./avatar-image";
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
test("public covers keep useful resolution and still remove metadata within server limits", async () => {
  const input = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: "blue" } }).jpeg().withMetadata().toBuffer();
  const output = await normalizeRasterImage(input, 2048);
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.width, 2048);assert.equal(metadata.height, 1024);
  assert.equal(metadata.exif, undefined);assert.equal(metadata.format, "webp");
  assert.ok(output.length <= 2 * 1024 * 1024);
  assert.equal(AVATAR_INPUT_LIMIT, 4 * 1024 * 1024);
});
