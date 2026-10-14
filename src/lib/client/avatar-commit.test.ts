import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Execute the endpoint with a lost commit acknowledgement. This is a regression
// test for distributed failure, not evidence of real Storage acceptance.
test("avatar keeps uploaded bytes when swap acknowledgement is lost after commit", async () => {
  for (const uncertain of [true, false]) {
    const removed: string[] = [];
    const admin = {
      rpc: async (name: string) => name === "swap_account_avatar"
        ? { data: null, error: uncertain ? { message: "transport failed" } : null }
        : { data: [], error: null },
      storage: { from: () => ({ upload: async () => ({ error: null }),
        remove: async (paths: string[]) => { removed.push(...paths); return { error: null }; } }) },
    };
    const dependencies: Record<string, unknown> = {
      "node:crypto": { randomUUID: () => "new-upload" },
      "next/cache": { revalidatePath() {} },
      "@/lib/supabase/server": { createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "self", email_confirmed_at: "confirmed" } } }) },
        from: () => ({ select() { return this; }, eq() { return this; },
          single: async () => ({ data: { avatar_path: null }, error: null }) }),
      }) },
      "@/lib/supabase/avatar-admin": { createAvatarAdmin: () => admin },
      "@/lib/client/avatar-image": { AVATAR_INPUT_LIMIT: 100, normalizeAvatar: async () => Buffer.from("webp") },
      "@/lib/http/origin": { getRequestOrigin: async () => "https://agende.test" },
    };
    const source = readFileSync(new URL("../../app/api/account/avatar/route.ts", import.meta.url), "utf8");
    const exports = {} as { PUT: (request: Request) => Promise<Response> };
    runInNewContext(ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    } }).outputText, { exports, Buffer, Response, require: (name: string) => {
      assert.ok(name in dependencies, name); return dependencies[name];
    } });
    const response = await exports.PUT(new Request("https://agende.test/api/account/avatar", {
      method: "PUT", headers: { origin: "https://agende.test" }, body: "image",
    }));
    assert.equal(response.status, uncertain ? 503 : 409);
    assert.deepEqual(removed, uncertain ? [] : ["avatars/self/new-upload.webp"]);
  }
});
