import assert from "node:assert/strict";
import test from "node:test";
import { checkoutMessage } from "./checkout-message";

test("checkout distinguishes total, received and remaining without inventing commission absence", () => {
  for (const [received, pending] of [[0, "100,00"], [4000, "60,00"], [10000, "0,00"]] as const) {
    const text = checkoutMessage({ repeated: false, amount_due_cents: 10000, product_total_cents: 0, received_cents: received, commission: null });
    assert.ok(text.includes("Total R$"));
    assert.ok(text.includes(`Pendente R$\u00a0${pending}`) || text.includes(`Pendente R$ ${pending}`));
    assert.doesNotMatch(text, /comissão|A receber/);
  }
  assert.match(checkoutMessage({ repeated: false, amount_due_cents: 0, product_total_cents: 0, received_cents: 0, commission: null }), /Pendente/);
});
