import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarketingPricing } from "./pricing";
import { PLANS } from "../../lib/marketing/content";
import { ANNUAL_SAVINGS_COPY, parseBillingIntervalId, planSignupHref } from "../../lib/billing/plans";

test("pricing cards open on monthly prices with the Mensal | Anual toggle and plan-specific signup links", () => {
  const html = renderToStaticMarkup(createElement(MarketingPricing));
  for (const plan of PLANS) {
    assert.ok(html.includes(plan.price));
    assert.ok(html.includes(`ou ${plan.annualPrice} no anual`));
    assert.ok(html.includes(plan.description));
    assert.ok(html.includes(planSignupHref(plan.id)));
    assert.ok(html.includes(`Começar com ${plan.name}`));
    for (const highlight of plan.highlights) {
      assert.ok(html.includes(highlight));
    }
  }
  assert.ok(html.includes("7 dias grátis"));
  assert.ok(html.includes("/cadastro?plan=equipe"));
  assert.match(html, /aria-pressed="true"[^>]*>Mensal/);
  assert.match(html, />Anual/);
  assert.ok(html.includes(ANNUAL_SAVINGS_COPY));
});

test("annual prices are 10 monthly payments and the equivalents are exact to the cent", () => {
  assert.deepEqual(PLANS.map((plan) => plan.annualPriceCents), [39900, 79900, 149900]);
  assert.deepEqual(PLANS.map((plan) => plan.annualPrice), ["R$ 399/ano", "R$ 799/ano", "R$ 1.499/ano"]);
  for (const plan of PLANS) {
    // 12 months for the price of 10 (rounded to whole reais).
    assert.ok(Math.abs(plan.annualPriceCents - plan.priceCents * 10) <= 100, plan.id);
    const equivalent = (plan.annualPriceCents / 12 / 100).toFixed(2).replace(".", ",");
    assert.equal(plan.annualMonthlyEquivalent, `R$ ${equivalent}/mês`);
  }
  assert.equal(planSignupHref("salao", "annual"), "/cadastro?plan=salao&periodo=anual");
  assert.equal(parseBillingIntervalId("anual"), "annual");
  assert.equal(parseBillingIntervalId("mensal"), "monthly");
  assert.equal(parseBillingIntervalId("semestral"), null);
});
