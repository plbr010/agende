import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import sharp from "sharp";
import { normalizeAvatar } from "@/lib/client/avatar-image";
import { readImageBody, imageHeaders } from "./http";

const id = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
function route(options: { role?: string; owns?: boolean; confirmed?: boolean; origin?: string; swap?: boolean; uncertain?: boolean; readable?: boolean } = {}) {
  const calls: string[] = [];
  const profile = { workspace_id: "33333333-3333-4333-8333-333333333333", photo_path: "old.webp" };
  const chain = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: profile }),
    then(resolve: (value: unknown) => void) { resolve({ data: [{ id: options.owns === false ? actorId : id, role: options.role ?? "professional", status: "active" }] }); } };
  const client = { auth: { getUser: async () => ({ data: { user: { id: actorId, email_confirmed_at: options.confirmed === false ? null : "2026-10-01" } } }) },
    from: () => chain, rpc: async () => ({ data: options.readable === false ? null : "current.webp", error: null }) };
  const admin = { rpc: async (name: string) => {
    calls.push(name);
    return { data: name === "swap_professional_photo" ? options.swap !== false : name === "claim_professional_photo_cleanup" ? ["old.webp"] : null,
      error: name === "swap_professional_photo" && options.uncertain ? { code: "network" } : null };
  }, storage: { from: () => ({ upload: async (_path: string, bytes: Uint8Array) => {
    calls.push("upload"); const metadata = await sharp(bytes).metadata(); assert.equal(metadata.format, "webp"); assert.equal(metadata.exif, undefined); return { error: null };
  }, remove: async () => { calls.push("remove"); return { error: null }; }, download: async () => { calls.push("download"); return { data: new Blob(["safe-image"]), error: null }; } }) } };
  const dependencies: Record<string, unknown> = { "zod": { z }, "node:crypto": { randomUUID: () => id }, "next/cache": { revalidatePath() {} },
    "@/lib/supabase/server": { createClient: async () => client }, "@/lib/supabase/avatar-admin": { createAvatarAdmin: () => { calls.push("admin"); return admin; } },
    "@/lib/client/avatar-image": { normalizeAvatar }, "@/lib/http/origin": { getRequestOrigin: async () => "https://staging.invalid" },
    "@/lib/media/http": { readImageBody, imageHeaders } };
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync("src/app/api/professionals/photo/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, URL, Response, Request, Buffer, Error, require(name: string) { if (name in dependencies) return dependencies[name]; throw Error(name); } });
  return { calls, ...(exports as { PUT: (request: Request) => Promise<Response>; DELETE: (request: Request) => Promise<Response>; GET: (request: Request) => Promise<Response> }) };
}
function request(bytes: Uint8Array = new Uint8Array(), method = "PUT", origin = "https://staging.invalid") {
  return new Request(`https://staging.invalid/api/professionals/photo?memberId=${id}`, { method, body: method === "PUT" ? bytes as BodyInit : undefined,
    headers: { Origin: origin, "Content-Type": "image/jpeg", "X-Image-Extension": "jpg", "X-Public-Photo-Consent": "true" } });
}
test("photo HTTP denies CSRF, unconfirmed users and foreign professional before privileged storage", async () => {
  for (const options of [{ confirmed: false }, { owns: false }, { role: "receptionist" }]) {
    const handler = route(options); assert.ok((await handler.PUT(request())).status >= 400); assert.deepEqual(handler.calls, []);
  }
  const handler = route(); assert.equal((await handler.PUT(request(undefined, "PUT", "https://foreign.invalid"))).status, 403); assert.deepEqual(handler.calls, []);
});
test("photo HTTP uploads fully decoded metadata-free bytes; deletion swaps before cleaning Storage", async () => {
  const image = await sharp({ create: { width: 128, height: 128, channels: 3, background: "red" } }).jpeg().withMetadata().toBuffer();
  const handler = route(); const saved = await handler.PUT(request(image)); assert.equal(saved.status, 200);
  assert.deepEqual(handler.calls, ["admin", "queue_professional_photo", "upload", "swap_professional_photo", "claim_professional_photo_cleanup", "remove", "finish_professional_photo_cleanup"]);
  const removed = route(); assert.equal((await removed.DELETE(request(undefined, "DELETE"))).status, 200);
  assert.ok(!removed.calls.includes("upload")); assert.ok(removed.calls.indexOf("swap_professional_photo") < removed.calls.indexOf("remove"));
});
test("photo HTTP rejects executable bytes and uncertain commits never delete potentially live bytes", async () => {
  const invalid = route(); assert.equal((await invalid.PUT(request(Buffer.from("MZ fake image.jpg")))).status, 422); assert.deepEqual(invalid.calls, []);
  const image = await sharp({ create: { width: 64, height: 64, channels: 3, background: "blue" } }).png().toBuffer();
  for (const options of [{ swap: false }, { uncertain: true }]) {
    const handler = route(options); assert.ok((await handler.PUT(request(image))).status >= 400); assert.ok(!handler.calls.includes("remove"));
  }
});
test("photo HTTP GET checks visibility before service access and sends no transferable URL or cache", async () => {
  const denied = route({ readable: false }); assert.equal((await denied.GET(request(undefined, "GET"))).status, 404); assert.deepEqual(denied.calls, []);
  const allowed = route(); const response = await allowed.GET(request(undefined, "GET")); assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal(response.headers.get("content-type"), "image/webp");
});
