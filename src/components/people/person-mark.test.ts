import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import type { ReactElement } from "react";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import ts from "typescript";

// Preserve hook state across prop changes, then deliver browser image events.
// This is a component regression test, not an HTTP or browser acceptance test.
function component() {
  let value: unknown;
  let initialized = false;
  const exports: { PersonMark?: (props: { name: string; photoUrl: string }) => ReactElement } = {};
  const compiled = ts.transpileModule(readFileSync(new URL("./person-mark.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  runInNewContext(compiled.outputText, {
    exports,
    require(name: string) {
      if (name === "react/jsx-runtime") return jsx;
      if (name === "react") return { ...React, useState(initial: unknown) {
        if (!initialized) { value = initial; initialized = true; }
        return [value, (next: unknown) => { value = next; }];
      } };
      if (name === "@/lib/utils") return { cn: (...items: unknown[]) => items.filter(Boolean).join(" ") };
      throw new Error("Unexpected dependency");
    },
  });
  return (url: string) => exports.PersonMark!({ name: "Cliente QA", photoUrl: url }) as ReactElement<{
    onError: () => void;
    ref: (image: { complete: boolean; naturalWidth: number }) => void;
    src: string;
  }>;
}

test("a missing photo does not hide the next client's valid photo in a reused dialog", () => {
  const render = component();
  const missing = render("/api/clients/avatar?clientId=missing");
  missing.props.onError();
  assert.equal(render("/api/clients/avatar?clientId=missing").type, "span");
  assert.equal(render("/api/clients/avatar?clientId=valid").type, "img");
  // A late error belonging to the old request must not poison the new source.
  missing.props.onError();
  assert.equal(render("/api/clients/avatar?clientId=valid").type, "img");
});

test("a previously completed broken image falls back, while a changed photo version can retry", () => {
  const render = component();
  render("/photo?v=1").props.ref({ complete: true, naturalWidth: 0 });
  assert.equal(render("/photo?v=1").type, "span");
  assert.equal(render("/photo?v=2").type, "img");
});
