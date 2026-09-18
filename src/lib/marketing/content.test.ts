import assert from "node:assert/strict";
import test from "node:test";
import {
  AUDIENCE,
  BOOKING_STEPS,
  FEATURES,
  FOOTER_LINKS,
  HOW_IT_WORKS,
  MARKETING_CTAS,
  MARKETING_NAV,
  PLANS,
  PROBLEMS,
} from "./content";

test("plans use the exact public prices and seats", () => {
  assert.deepEqual(
    PLANS.map((plan) => ({
      name: plan.name,
      seats: plan.seats,
      price: plan.price,
      period: plan.period,
      popular: plan.popular,
    })),
    [
      {
        name: "Solo",
        seats: "1 profissional",
        price: "R$ 89,90",
        period: "/mês",
        popular: false,
      },
      {
        name: "Equipe",
        seats: "Até 5 profissionais",
        price: "R$ 169,90",
        period: "/mês",
        popular: true,
      },
      {
        name: "Salão",
        seats: "Até 15 profissionais",
        price: "R$ 299,90",
        period: "/mês",
        popular: false,
      },
    ],
  );
});

test("every plan is presented with a free trial and no card in the primary CTA", () => {
  assert.equal(MARKETING_CTAS.primary.label, "Começar 7 dias grátis");
  assert.equal(MARKETING_CTAS.primary.href, "/cadastro");
  assert.equal(MARKETING_CTAS.secondary.label, "Ver como funciona");
});

test("header and footer expose the required public links", () => {
  assert.deepEqual(
    MARKETING_NAV.map((item) => item.label),
    ["Funcionalidades", "Como funciona", "Planos"],
  );
  assert.deepEqual(
    FOOTER_LINKS.map((item) => item.label),
    ["Produto", "Termos", "Privacidade", "Entrar", "Cadastro"],
  );
  assert.equal(FOOTER_LINKS.some((item) => /instagram|facebook|tiktok/i.test(item.href)), false);
});

test("landing covers the product vision without fake WhatsApp automation", () => {
  const blob = JSON.stringify({
    AUDIENCE,
    PROBLEMS,
    FEATURES,
    BOOKING_STEPS,
    HOW_IT_WORKS,
  });
  assert.match(blob, /WhatsApp/);
  assert.doesNotMatch(blob, /WhatsApp autom[aá]tico/i);
  assert.doesNotMatch(blob, /integra(ção|cao) com WhatsApp/i);
  assert.ok(FEATURES.some((feature) => feature.title === "Agenda"));
  assert.ok(FEATURES.some((feature) => feature.title === "Agendamento online"));
  assert.ok(FEATURES.some((feature) => feature.title === "Histórico de atendimentos"));
  assert.equal(HOW_IT_WORKS.length, 5);
  assert.equal(BOOKING_STEPS.length, 5);
});
