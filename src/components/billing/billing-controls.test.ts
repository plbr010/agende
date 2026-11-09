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
test("billing component renders the 2026-11-09 monthly and annual prices", () => {
  const monthly = render();
  for (const price of ["R$ 39,90/mês", "R$ 79,90/mês", "R$ 149,90/mês"]) assert.ok(monthly.includes(price), price);
  assert.match(monthly, /Periodicidade/);
  assert.match(monthly, /Durante o teste nada é cobrado/);
  assert.equal((monthly.match(/Assinar (Solo|Equipe|Salão) mensal/g) ?? []).length, 3);
  const annual = render({ initialInterval: "annual" });
  for (const price of ["R$ 399/ano", "R$ 799/ano", "R$ 1.499/ano", "R$ 33,25/mês", "R$ 66,58/mês", "R$ 124,92/mês"]) assert.ok(annual.includes(price), price);
  assert.match(annual, /16,7%/);
  assert.match(annual, /pago de uma vez/);
  assert.match(annual, /Não é parcelado/);
  assert.equal((annual.match(/Assinar (Solo|Equipe|Salão) anual/g) ?? []).length, 3);
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
