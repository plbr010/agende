import assert from "node:assert/strict";
import test from "node:test";
import { avatarCacheVersion, avatarUploadMessage, clampOffset, coverScale, coverScaleRect } from "./avatar-ui";

test("avatar messages hide technical codes and 503 is not treated as saved", () => {
  assert.match(avatarUploadMessage(422, "image_invalid"), /JPG, PNG ou WebP/);
  assert.match(avatarUploadMessage(409, "avatar_changed_retry"), /Atualize a página/);
  assert.match(avatarUploadMessage(503, "avatar_backend_unavailable"), /Tente de novo/);
  assert.doesNotMatch(avatarUploadMessage(503, "avatar_upload_failed"), /foto atualizada|sucesso/i);
});

test("avatar cache version does not reveal the storage path", () => {
  const path = "avatars/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.webp";
  const version = avatarCacheVersion(path);
  assert.ok(version);
  assert.equal(version?.includes("avatars"), false);
  assert.equal(version?.includes("11111111"), false);
  assert.equal(avatarCacheVersion(null), null);
  assert.equal(avatarCacheVersion(path), version);
});

test("crop keeps the photo covering the frame", () => {
  assert.equal(coverScale(1000, 500, 200, 1), 0.4);
  assert.equal(coverScaleRect(1000, 500, 250, 100, 1), 0.25);
  assert.equal(clampOffset(999, 1000, 0.4, 200), 100);
  assert.equal(clampOffset(-999, 1000, 0.4, 200), -100);
});
