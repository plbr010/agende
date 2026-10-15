import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { File } from "node:buffer";

function moduleSource<T>(file: string, dependencies: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Buffer, File, Error, console: { error() {} }, require(name: string) {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected module ${name}`);
  } });
  return exports as T;
}

test("public image action refuses foreign roles, absent consent and oversized input before privileged access", async () => {
  for (const scenario of ["foreign", "consent", "size"]) {
    let accesses = 0;
    const action = moduleSource<{ saveWorkspaceImageAction: (state: object, form: FormData) => Promise<{ error?: string }> }>("./image-actions.ts", {
      "next/cache": {}, "@/lib/auth/session": { requireConfirmedSession: async () => ({ workspaces: scenario === "foreign" ? [] : [{ id: "own", role: "owner" }] }) },
      "@/lib/supabase/server": { createClient: () => { accesses++; throw new Error("unexpected database access"); } },
      "@/lib/supabase/avatar-admin": { createAvatarAdmin: () => { accesses++; throw new Error("unexpected privileged access"); } },
      "@/lib/client/avatar-image": { AVATAR_INPUT_LIMIT: 100 },
      "@/lib/workspace/images": {}, "@/lib/workspace/queries": { isManagerRole: (role: string) => role === "owner" },
      "@/lib/workspace/settings-errors": { inactiveWorkspaceMessage: "Assinatura inativa" },
    }).saveWorkspaceImageAction;
    const form = new FormData();form.set("kind", "logo");form.set("image", new File([Buffer.alloc(scenario === "size" ? 101 : 10)], "test.jpg"));
    if (scenario === "size") form.set("publicConsent", "true");
    assert.ok((await action({}, form)).error);assert.equal(accesses, 0);
  }
});

test("public image upload preserves new bytes on uncertain or stale swap acknowledgement", async () => {
  for (const uncertain of [true, false]) {
    const removed: string[] = [];
    const client = { rpc: async (name: string) => name === "swap_workspace_image"
      ? { data: false, error: uncertain ? { code: "network", message: "network error" } : null } : { data: [], error: null } };
    const storage = { storage: { from: () => ({ upload: async () => ({ error: null }), remove: async (paths: string[]) => { removed.push(...paths);return { error: null }; } }) } };
    const mod = moduleSource<{ saveWorkspaceImage: (...args: unknown[]) => Promise<unknown> }>("./images.ts", {
      "node:crypto": { randomUUID: () => "test-upload" },
      "@/lib/client/avatar-image": { normalizeRasterImage: async () => Buffer.from("normalized") },
    });
    await assert.rejects(mod.saveWorkspaceImage(client, storage, "own", "logo", null, new File(["image"], "test.jpg")), /image_save_failed|image_changed_retry/);
    assert.equal(removed.length, 0);
  }
});
