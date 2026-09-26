import { resolvePeriod, todayInTimezone } from "@/lib/modules/periods";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { getAppNavigation } from "@/config/app-navigation";
import { canAccessWorkspacePath, type WorkspaceRole } from "./permissions";
import { createConfirmedSessionGuard } from "./session-guard";
import type { AppSession } from "./session";
import { createOperationalModuleLoaders } from "@/lib/modules/operational-loaders";
import { inventoryUiRpcFixture, packagesUiRpcFixture, financeUiRpcFixture, advancedReportRpcFixture } from "@/test-fixtures/operational-rpcs";

const routes = ["/app/estoque", "/app/pacotes", "/app/financeiro", "/app/relatorios"] as const;

function sessionFor(role: WorkspaceRole): AppSession {
  return {
    user: { id: "user-1", email: "user@example.test", emailConfirmed: true },
    profile: { fullName: "Test", email: "user@example.test", phone: null, intendedUse: "professional" },
    context: { emailConfirmed: true, intendedUse: "professional", hasWorkspace: true, hasClientProfile: false },
    workspaces: [{ id: "workspace-1", name: "Test", slug: "test", role }],
    subscription: null,
  };
}

class Redirect extends Error {
  constructor(readonly destination: string) { super(destination); }
}
const redirect = (path: string): never => { throw new Redirect(path); };

// Execute the actual server page orchestration with isolated session/RPC dependencies.
// UI imports are inert: these tests verify authorization before any data is requested.
function loadServerPage(
  route: string,
  requireSession: ReturnType<typeof createConfirmedSessionGuard>,
  loaders: ReturnType<typeof createOperationalModuleLoaders>,
): () => Promise<unknown> {
  const source = readFileSync(new URL(`../../app${route}/page.tsx`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports: { default?: (props: {searchParams: Promise<object>}) => Promise<unknown> } = {};
  runInNewContext(outputText, {
    exports,
    require(name: string) {
      if (name === "@/lib/auth/session") return { requireConfirmedSession: requireSession };
      if (name === "@/lib/modules/operational-loaders.server") return { operationalModuleLoaders: loaders };
      if (name === "@/lib/time/timezone") return { todayInProductTz: () => "2026-09-23" };
      if (name === "@/lib/modules/periods") return { resolvePeriod, todayInTimezone };
      if (name === "@/lib/workspace/queries") return { loadWorkspaceSettings: async () => ({ timezone: "America/Sao_Paulo" }) };
      if (name === "@/lib/catalog/queries") return { loadServices: async () => [], loadClients: async () => [] };
      if (name === "react/jsx-runtime") return { jsx: () => ({}), jsxs: () => ({}), Fragment: "fragment" };
      if (name === "lucide-react" || name.startsWith("@/components/")) return {};
      throw new Error(`Unexpected page dependency: ${name}`);
    },
  });
  assert.ok(exports.default);
  return () => exports.default!({searchParams: Promise.resolve({})});
}

for (const role of ["owner", "admin", "professional", "receptionist"] as const) {
  const allowed = role === "owner" || role === "admin";
  test(`${role}: menu and nested routes use the same permissions`, () => {
    const links = getAppNavigation(role).flatMap((group) => group.items.map((item) => item.href));
    for (const route of routes) {
      assert.equal(links.includes(route), allowed, route);
      assert.equal(canAccessWorkspacePath(route, role), allowed);
      assert.equal(canAccessWorkspacePath(`${route}/detalhe?periodo=mes#total`, role), allowed);
    }
    assert.ok(links.includes("/app"));
    assert.ok(links.includes("/app/agenda"));
    assert.ok(links.includes("/app/clientes"));
  });

  for (const route of routes) {
    test(`${role}: direct access to ${route} is checked before the backend`, async () => {
      const session = sessionFor(role);
      const requireSession = createConfirmedSessionGuard(async () => session, redirect);
      const calls: string[] = [];
      const loaders = createOperationalModuleLoaders({
        inventory: { async loadInventory(id) { calls.push(id); return inventoryUiRpcFixture; } },
        packages: {
          async loadPackages(id) { calls.push(id); return packagesUiRpcFixture; },
          async sellPackage() { throw new Error("unexpected mutation"); },
          async cancelClientPackage() { throw new Error("unexpected mutation"); },
          async reversePackageRedemption() { throw new Error("unexpected mutation"); },
        },
        finance: {
          async loadFinance(input) { calls.push(input.workspaceId); return financeUiRpcFixture; },
          async createEntry() { throw new Error("unexpected mutation"); },
          async markEntryPaid() { throw new Error("unexpected mutation"); },
          async cancelEntry() { throw new Error("unexpected mutation"); },
          async reopenEntry() { throw new Error("unexpected mutation"); },
          async refundEntry() { throw new Error("unexpected mutation"); },
        },
        reports: { async loadAdvancedReport(input) { calls.push(input.workspaceId); return advancedReportRpcFixture; } },
      });
      const renderRoute = loadServerPage(route, requireSession, loaders);
      if (allowed) {
        assert.ok(await renderRoute());
        assert.deepEqual(calls, ["workspace-1"]);
      } else {
        await assert.rejects(renderRoute, (error: unknown) => error instanceof Redirect && error.destination === "/app");
        assert.deepEqual(calls, []);
      }
    });
  }
}

test("missing role denies protected paths without hiding unrelated routes", () => {
  for (const role of [null, undefined]) {
    for (const route of routes) assert.equal(canAccessWorkspacePath(route, role), false);
    assert.equal(canAccessWorkspacePath("/app/agenda", role), true);
  }
  assert.equal(canAccessWorkspacePath("/app/estoque-extra", "professional"), true);
});

test("a manager membership in another workspace cannot authorize the active workspace", async () => {
  const session = sessionFor("professional");
  session.workspaces.push({ id: "workspace-2", name: "Other", slug: "other", role: "owner" });
  const guard = createConfirmedSessionGuard(async () => session, redirect);
  await assert.rejects(() => guard("/app/estoque"), (error: unknown) => error instanceof Redirect && error.destination === "/app");
});

test("server guard preserves login, confirmation and onboarding redirects", async () => {
  const cases: Array<[AppSession | null, string]> = [
    [null, "/login?next=%2Fapp%2Festoque"],
    [{ ...sessionFor("owner"), context: { ...sessionFor("owner").context, emailConfirmed: false } }, "/verificar-email"],
    [{ ...sessionFor("owner"), workspaces: [], context: { ...sessionFor("owner").context, hasWorkspace: false } }, "/onboarding"],
  ];
  for (const [session, destination] of cases) {
    const guard = createConfirmedSessionGuard(async () => session, redirect);
    await assert.rejects(() => guard("/app/estoque"), (error: unknown) => error instanceof Redirect && error.destination === destination);
  }
});
