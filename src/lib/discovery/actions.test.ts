import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as contract from "./contract";

function isolatedSearch(rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>) {
  const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {} as {
    searchPublicWorkspacesAction: (input: object) => Promise<{ status: string; items: unknown[] }>;
    listPublicLocalitiesAction: (query: string, state?: string) => Promise<unknown[]>;
  };
  runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      if (name === "@/lib/supabase/server") {
        return { createClient: async () => ({ rpc }) };
      }
      if (name === "./contract") return contract;
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return exports;
}

test("discovery actions never invent salons when the RPC is absent", async () => {
  const calls: string[] = [];
  const actions = isolatedSearch(async (name) => {
    calls.push(name);
    return { data: null, error: { code: "PGRST202", message: "could not find the function" } };
  });
  const result = await actions.searchPublicWorkspacesAction({ city: "Salvador", state: "BA" });
  assert.equal(result.status, "unavailable");
  assert.deepEqual(result.items, []);
  assert.deepEqual(calls, ["search_public_workspaces"]);
  assert.deepEqual(await actions.listPublicLocalitiesAction("Sal"), []);
});

test("discovery actions map verified RPC rows and skip GPS in the v1 body", async () => {
  const actions = isolatedSearch(async (name, args) => {
    assert.equal(name, "search_public_workspaces");
    assert.equal("p_latitude" in args, false);
    assert.equal(args.p_city, "Curitiba");
    return {
      data: {
        items: [{ name: "Ateliê Luz", slug: "atelier-luz", city: "Curitiba", state: "PR", booking_open: true }],
        total: 1,
      },
      error: null,
    };
  });
  const result = await actions.searchPublicWorkspacesAction({
    mode: "city",
    city: "Curitiba",
    state: "PR",
    coordinates: { latitude: -25.43, longitude: -49.27 },
  });
  assert.equal(result.status, "ready");
  assert.equal((result.items[0] as { slug: string }).slug, "atelier-luz");
});
