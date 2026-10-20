import assert from "node:assert/strict";
import test from "node:test";
import { bookingReceiptCopy } from "./receipt";

test("a new public booking is a request until the salon confirms it", () => {
  const pending = bookingReceiptCopy("scheduled");
  assert.equal(pending.title, "Solicitação recebida");
  assert.match(pending.lead, /ainda não está confirmado/);
  assert.equal(pending.statusLabel, "Aguardando confirmação");
  assert.doesNotMatch(pending.title, /confirmado/i);
});

test("only a confirmed status uses the confirmation title", () => {
  assert.equal(bookingReceiptCopy("confirmed").title, "Agendamento confirmado!");
  assert.equal(bookingReceiptCopy("cancelled").statusLabel, "Cancelado");
  assert.equal(bookingReceiptCopy("cancelled").title, "Agendamento registrado");
});
