import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as validation from "../validation/catalog";
import * as money from "../validation/money";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const professionalId = "22222222-2222-4222-8222-222222222222";
function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: "Corte", description: "", priceReais: "50,00", durationMinutes: "30", active: "on", professionalMemberIds: professionalId })) data.set(key, value);
  data.set("workspace_id", "33333333-3333-4333-8333-333333333333");
  return data;
}

export function isolatedServiceAction(client: unknown, role = "owner") {
  const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {} as { saveServiceAction: (previous: object, data: FormData) => Promise<{ error?: string; success?: string }> };
  const dependencies: Record<string, unknown> = {
    "next/cache": { revalidatePath() {} }, "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/auth/session": { requireConfirmedSession: async () => ({ workspaces: [{ id: workspaceId, role }] }) },
    "@/lib/validation/catalog": validation, "@/lib/validation/money": money,
    "@/lib/catalog/queries": { canManageServices: (value: string) => ["owner", "admin"].includes(value) },
  };
  runInNewContext(outputText, { exports, Set, require: (name: string) => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected import ${name}`);
  } });
  return exports.saveServiceAction;
}

test("failed professional linkage cannot leave a partially created service", async () => {
  let created = false;
  const client = {
    from(table: string) {
      return { insert() {
        if (table === "services") { created = true; return { select() { return this; }, single: async () => ({ data: { id: "service" }, error: null }) }; }
        return Promise.resolve({ error: { message: "professional_services_professional_fk" } });
      }, select() { return this; }, eq() { return this; }, then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: [] }).then(resolve); } };
    },
    rpc: async () => ({ data: null, error: { message: "professional_not_found" } }),
  };
  assert.ok((await isolatedServiceAction(client)({}, form())).error);
  assert.equal(created, false, "service and links must commit or fail in the same transaction");
});

test("service action derives the tenant from session and calls one atomic RPC", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const result = await isolatedServiceAction({ rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args }); return { data: "service-id", error: null };
  } })({}, form());
  assert.ok(result.success);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "save_service_with_professionals");
  assert.equal(calls[0].args.p_workspace_id, workspaceId);
  assert.equal(calls[0].args.p_price_cents, 5000);
});

test("missing atomic service RPC and unprivileged roles never fall back to partial writes", async () => {
  for (const role of ["professional", "receptionist"]) {
    assert.ok((await isolatedServiceAction({ rpc: () => assert.fail("unauthorized write") }, role)({}, form())).error);
  }
  const result = await isolatedServiceAction({ rpc: async () => ({ error: { code: "PGRST202", message: "schema cache" } }), from: () => assert.fail("no unsafe fallback") })({}, form());
  assert.match(result.error!, /temporariamente|atualização/);
});
