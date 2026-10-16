import assert from "node:assert/strict";
import { test } from "node:test";
import { readImageBody } from "./http";
import { AVATAR_INPUT_LIMIT } from "@/lib/client/avatar-image";
test("bounded image stream rejects excess with or without declared Content-Length", async () => {
  await assert.rejects(readImageBody(new Request("http://localhost", { method: "PUT", body: "small", headers: { "Content-Length": String(AVATAR_INPUT_LIMIT + 1) } })), /image_size_invalid/);
  await assert.rejects(readImageBody(new Request("http://localhost", { method: "PUT", body: new Uint8Array(AVATAR_INPUT_LIMIT + 1) })), /image_size_invalid/);
  assert.equal(Buffer.from(await readImageBody(new Request("http://localhost", { method: "PUT", body: "bytes" }))).toString(), "bytes");
});
