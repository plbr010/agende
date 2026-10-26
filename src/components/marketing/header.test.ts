import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { MarketingHeader } from "./header";

function render(node: ReactElement) {
  const noop = () => {};
  return renderToStaticMarkup(
    createElement(AppRouterContext.Provider, {
      value: {
        back: noop,
        forward: noop,
        refresh: noop,
        push: noop,
        replace: noop,
        prefetch: noop,
        bfcacheId: "test",
      },
    }, node),
  );
}

test("Comece agora in the public header opens the account choice and leaves login alone", () => {
  const html = render(createElement(MarketingHeader));
  assert.match(html, /href="\/cadastro"/);
  assert.match(html, /Comece agora/);
  assert.match(html, /href="\/login"/);
  assert.match(html, /Entrar/);
  assert.doesNotMatch(html, /href="\/comecar"/);
  assert.match(html, /href="\/profissionais"/);
  assert.match(html, /href="\/descobrir"/);
});
