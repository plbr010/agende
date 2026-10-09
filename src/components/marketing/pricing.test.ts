import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarketingPricing } from "./pricing";
import { PLANS } from "../../lib/marketing/content";
import { planSignupHref } from "../../lib/billing/plans";

test("pricing cards keep monthly prices, annual prices and plan-specific signup links", () => {
  const html = renderToStaticMarkup(createElement(MarketingPricing));
  for (const plan of PLANS) {
    assert.ok(html.includes(plan.price));
    assert.ok(html.includes(plan.annualPrice));
    assert.ok(html.includes(planSignupHref(plan.id)));
    assert.ok(html.includes(`Começar com ${plan.name}`));
    for (const highlight of plan.highlights) {
      assert.ok(html.includes(highlight));
    }
  }
  assert.ok(html.includes("7 dias grátis"));
  assert.ok(html.includes("/cadastro?plan=equipe"));
});
