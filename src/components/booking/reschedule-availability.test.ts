import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as timezone from "../../lib/time/timezone";

type Node = { props?: Record<string, unknown> };
function nodes(value: unknown): Node[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  const node = value as Node;
  return [node, ...nodes(node.props?.children)];
}
function harness(original: string | null, people: { id: string; serviceIds: string[] }[]) {
  const state: unknown[] = [], effects: (() => unknown)[] = [], requests: unknown[] = [];
  let index = 0;
  const react = {
    useState: (initial: unknown) => {
      const i = index++;
      if (!(i in state)) state[i] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [state[i], (value: unknown) => { state[i] = typeof value === "function" ? (value as (old: unknown) => unknown)(state[i]) : value; }];
    },
    useEffect: (fn: () => unknown, deps: unknown[]) => {
      const i = index++, old = state[i] as unknown[] | undefined;
      if (!old || deps.some((value, n) => value !== old[n])) { state[i] = deps; effects.push(fn); }
    },
    useTransition: () => [false, () => { throw new Error("No mutation expected"); }],
  };
  const noop = () => null;
  const dependencies: Record<string, unknown> = {
    react,
    "react/jsx-runtime": { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
    "@/lib/time/timezone": timezone,
    "@/lib/booking/actions": {
      loadCatalogAction: async () => ({ professionals: people, horizonDays: 90 }),
      fetchMyRescheduleSlots: async (input: unknown) => { requests.push(input); return { slots: ["2026-11-02T13:00:00Z"] }; },
    },
  };
  const exports: { RescheduleDialog?: (props: unknown) => Node } = {};
  const stub = new Proxy({}, { get: () => noop });
  runInNewContext(ts.transpileModule(readFileSync("src/components/booking/reschedule-dialog.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: (name: string) => dependencies[name] ?? stub });
  const props = { appointment: { id: "appointment", serviceId: "service", serviceName: "Corte", slug: "salon", professionalMemberId: original, timezone: "America/Sao_Paulo" }, onClose: noop, onSaved: noop };
  const render = () => { index = 0; return exports.RescheduleDialog!(props); };
  return {
    requests,
    async settle() { let tree = render(); for (let n = 0; n < 5; n++) { for (const effect of effects.splice(0)) effect(); await Promise.resolve(); await Promise.resolve(); tree = render(); } return tree; },
  };
}

test("reschedule without an assigned professional waits for an explicit selection without spinning forever", async () => {
  const h = harness(null, [{ id: "available", serviceIds: ["service"] }]);
  const tree = await h.settle();
  assert.equal(h.requests.length, 0);
  assert.ok(!nodes(tree).some(n => n.props?.children === "Buscando horários..."));
  assert.ok(nodes(tree).some(n => n.props?.children === "Selecione um profissional para ver os horários."));
});

test("reschedule does not query a professional removed from the bookable service", async () => {
  const h = harness("removed", [{ id: "other", serviceIds: ["service"] }]);
  const tree = await h.settle();
  assert.equal(h.requests.length, 0);
  assert.equal(nodes(tree).find(n => n.props?.id === "reschedule-professional")?.props?.value, "");
  assert.ok(!nodes(tree).some(n => n.props?.children === "Buscando horários..."));
});

test("reschedule with no eligible professional stops loading and explains the block", async () => {
  const h = harness("removed", [{ id: "unrelated", serviceIds: ["another-service"] }]);
  const tree = await h.settle();
  assert.equal(h.requests.length, 0);
  assert.ok(nodes(tree).some(n => n.props?.role === "alert" && String(n.props.children).includes("Nenhum profissional")));
  assert.ok(!nodes(tree).some(n => n.props?.children === "Buscando horários..."));
});

test("reschedule keeps the eligible assigned professional and loads actual slots", async () => {
  const h = harness("assigned", [{ id: "assigned", serviceIds: ["service"] }]);
  const tree = await h.settle();
  assert.equal(h.requests.length, 1);
  assert.equal((h.requests[0] as { professionalMemberId: string }).professionalMemberId, "assigned");
  assert.ok(!nodes(tree).some(n => n.props?.children === "Buscando horários..."));
});

test("customer explicitly selects an eligible professional and can review an available slot", async () => {
  const h = harness(null, [{ id: "available", serviceIds: ["service"] }]);
  let tree = await h.settle();
  const select = nodes(tree).find(n => n.props?.id === "reschedule-professional");
  (select!.props!.onChange as (event: { target: { value: string } }) => void)({ target: { value: "available" } });
  tree = await h.settle();
  assert.equal(h.requests.length, 1);
  const slot = nodes(tree).find(n => n.props?.children === timezone.formatTimeInTimeZone("2026-11-02T13:00:00Z", "America/Sao_Paulo"));
  assert.ok(slot);
  (slot.props!.onClick as () => void)();
  tree = await h.settle();
  assert.equal(nodes(tree).find(n => n.props?.children === "Revisar alteração")?.props?.disabled, false);
});
