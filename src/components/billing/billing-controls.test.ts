import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { BillingControls, type BillingControlsProps } from "./billing-controls";

const defaults: BillingControlsProps = {
  canManage: true, usedSeats: 1, hasCustomer: false, hasSubscription: false,
  status: "trialing", initialInterval: "monthly", capabilities: { checkout: true, portal: true },
  action: async () => { assert.fail("render must not create a checkout"); },
};
function render(props: Partial<BillingControlsProps> = {}) {
  const noop = () => {};
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: {
    back: noop, forward: noop, refresh: noop, push: noop, replace: noop, prefetch: noop, bfcacheId: "test",
  } }, createElement(BillingControls, { ...defaults, ...props })));
}
test("billing component renders the 2026-11-09 monthly prices and no annual offer", () => {
  const monthly = render();
  for (const price of ["R$ 39,90/mês", "R$ 79,90/mês", "R$ 149,90/mês"]) assert.ok(monthly.includes(price), price);
  assert.doesNotMatch(monthly, /\/ano|Anual|Periodicidade/);
  // An existing annual subscriber opening the page still gets monthly checkout buttons only.
  const annual = render({ initialInterval: "annual" });
  assert.doesNotMatch(annual, /\/ano|Assinar (Solo|Equipe|Salão) anual/);
  assert.equal((monthly.match(/Assinar (Solo|Equipe|Salão) mensal/g) ?? []).length, 3);
});
test("portal is only rendered for a manager with a Stripe customer", () => {
  assert.doesNotMatch(render(), /Abrir Portal Stripe/);
  assert.match(render({ hasCustomer: true }), /Abrir Portal Stripe/);
  assert.doesNotMatch(render({ hasCustomer: true, canManage: false }), /Abrir Portal Stripe/);
  assert.doesNotMatch(render({ hasCustomer: true, capabilities: { checkout: true, portal: false } }), /Abrir Portal Stripe/);
});
test("incompatible plans are disabled and return states never claim database activation", () => {
  assert.match(render({ usedSeats: 6 }), /disabled="" aria-describedby="billing-equipe-reason"/);
  assert.match(render({ checkoutReturn: "success" }), /role="status"/);
  assert.match(render({ checkoutReturn: "cancelled" }), /Checkout cancelado/);
  assert.doesNotMatch(render({ checkoutReturn: "success" }), /Assinatura ativada/);
});
