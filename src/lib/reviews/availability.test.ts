import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as validation from "./validation";
import type { ReviewsQueryResult } from "./queries";

function moduleFrom<T>(file: string, dependencies: Record<string, unknown>): T {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  runInNewContext(outputText, { exports, require(name: string) {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return exports as T;
}

function loader(error: { code: string; message?: string } | null, signedIn = true) {
  const filters: unknown[] = [];
  const query = {
    select() { return this; }, order() { return this; },
    eq(...args: unknown[]) { filters.push(args); return this; },
    then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: [], error }).then(resolve); },
  };
  const { loadReviewsResult } = moduleFrom<{ loadReviewsResult: (workspaceId?: string) => Promise<ReviewsQueryResult> }>("./queries.ts", {
    "@/lib/supabase/server": { createClient: async () => ({
      from: (table: string) => { assert.equal(table, "appointment_reviews"); return query; },
      auth: { getUser: async () => ({ data: { user: signedIn ? { id: "client" } : null } }) },
    }) },
  });
  return { loadReviews: loadReviewsResult, filters };
}

test("missing reviews schema has an unavailable state distinct from empty reviews", async () => {
  for (const code of ["PGRST205", "42P01"]) assert.equal((await loader({ code }).loadReviews()).schemaReady, false);
  const empty = await loader(null).loadReviews();
  assert.equal(empty.schemaReady, true);
  assert.equal(empty.reviews.length, 0);
  for (const code of ["42501", "PGRST301", "503"]) {
    await assert.rejects(loader({ code, message: "appointment_reviews schema cache private diagnostic" }).loadReviews, /Não foi possível carregar/);
  }
});

test("reviews stay scoped to the active tenant or verified client", async () => {
  const client = loader(null);
  await client.loadReviews();
  assert.equal(JSON.stringify(client.filters), JSON.stringify([["client_user_id", "client"]]));
  const workspace = loader(null);
  await workspace.loadReviews("workspace");
  assert.equal(JSON.stringify(workspace.filters), JSON.stringify([["workspace_id", "workspace"]]));
  const anonymous = loader({ code: "503" }, false);
  assert.equal((await anonymous.loadReviews()).reviews.length, 0);
  assert.equal(anonymous.filters.length, 0);
});

test("review action handles an undeployed RPC without claiming submission success", async () => {
  const paths: string[] = [];
  const { submitReview } = moduleFrom<{ submitReview: (input: unknown) => Promise<{ error?: string }> }>("./actions.ts", {
    "next/cache": { revalidatePath: (path: string) => paths.push(path) },
    "@/lib/reviews/validation": validation,
    "@/lib/reviews/queries": { loadReviewsResult: async () => { assert.fail("must not refresh failed submission"); } },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async () => ({ error: { code: "PGRST202", message: "schema cache" } }) }) },
  });
  const result = await submitReview({ appointmentId: "11111111-1111-4111-8111-111111111111", rating: 5, comment: "" });
  assert.match(result.error!, /temporariamente indisponíveis/);
  assert.equal(paths.length, 0);
});

test("both review pages render an unavailable notice without mounting submission UI", async () => {
  for (const route of ["cliente", "app"]) {
    let submissions = 0;
    const page = moduleFrom<{ default: () => Promise<unknown> }>(`../../app/${route}/avaliacoes/page.tsx`, {
      "react/jsx-runtime": { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }), Fragment: "fragment" },
      "lucide-react": { Star: "star" },
      "@/lib/auth/session": { requireConfirmedSession: async () => ({ workspaces: [{ id: "workspace", name: "Studio", slug: "studio" }] }) },
      "@/lib/booking/queries": { loadMyAppointments: async () => [] },
      "@/lib/reviews/queries": { loadReviewsResult: async () => ({ reviews: [], schemaReady: false }) },
      "@/lib/reviews/validation": validation,
      "@/lib/workspace/queries": { loadWorkspaceSettings: async () => ({ timezone: "America/Sao_Paulo" }) },
      "@/lib/time/timezone": {},
      "@/components/app/page-header": { PageHeader: "header" },
      "@/components/app/metric-card": { MetricCard: "metric" },
      "@/components/ui/card": {},
      "@/components/modules/backend-contract-notice": { BackendContractNotice: "notice" },
      "@/components/reviews/review-center": { get ReviewCenter() { submissions++; return "review-center"; } },
    });
    const tree = JSON.stringify(await page.default());
    assert.match(tree, /temporariamente indisponíveis/);
    assert.doesNotMatch(tree, /Nenhuma avaliação/);
    assert.equal(submissions, 0);
  }
});
