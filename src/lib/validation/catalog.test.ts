import assert from "node:assert/strict";
import test from "node:test";
import { formatCentsToReais, parseReaisToCents } from "./money";
import { clientSchema, parseProfileForm, serviceSchema } from "./catalog";

test("parses Brazilian reais into integer cents", () => {
  assert.equal(parseReaisToCents("80"), 8000);
  assert.equal(parseReaisToCents("80,50"), 8050);
  assert.equal(parseReaisToCents("R$ 1.234,56"), 123456);
  assert.equal(parseReaisToCents("0"), 0);
  assert.equal(parseReaisToCents("-1"), null);
  assert.equal(parseReaisToCents("abc"), null);
});

test("formats cents as BRL", () => {
  assert.match(formatCentsToReais(0), /0,00/);
  assert.match(formatCentsToReais(8050), /80,50/);
});

test("rejects negative service price and invalid duration", () => {
  assert.equal(serviceSchema.safeParse({
    name: "Corte",
    durationMinutes: 45,
    priceReais: "-10",
  }).success, false);
  assert.equal(serviceSchema.safeParse({
    name: "Corte",
    durationMinutes: 2,
    priceReais: "50",
  }).success, false);
  assert.equal(serviceSchema.safeParse({
    name: "Corte",
    durationMinutes: 480,
    priceReais: "50",
  }).success, true);
  assert.equal(serviceSchema.safeParse({
    name: "Corte",
    durationMinutes: 481,
    priceReais: "50",
  }).success, false);
  assert.equal(serviceSchema.safeParse({
    name: "Corte feminino",
    durationMinutes: 45,
    priceReais: "80,00",
  }).success, true);
});

test("client phone keeps DDD 55 and rejects short numbers", () => {
  const parsed = clientSchema.safeParse({
    fullName: "Maria Silva",
    phone: "(55) 99999-9999",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.phone, "+5555999999999");
  }
  assert.equal(
    clientSchema.safeParse({ fullName: "Maria Silva", phone: "99999-9999" }).success,
    false,
  );
});

test("client email is lowercased and empty phone stays null", () => {
  const parsed = clientSchema.safeParse({
    fullName: "Ana Souza",
    email: "Ana@Example.COM",
    phone: "",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.email, "ana@example.com");
    assert.equal(parsed.data.phone, null);
  }
});

test("profile form only reads booking when manageBooking is present", () => {
  const memberId = "11111111-1111-4111-8111-111111111111";
  const withoutFlag = new FormData();
  withoutFlag.set("memberId", memberId);
  withoutFlag.set("displayName", "Luna");
  const parsedOwn = parseProfileForm(withoutFlag);
  assert.equal(parsedOwn.success, true);
  if (parsedOwn.success) {
    assert.equal(parsedOwn.data.bookingEnabled, undefined);
  }

  const unchecked = new FormData();
  unchecked.set("memberId", memberId);
  unchecked.set("displayName", "Luna");
  unchecked.set("manageBooking", "1");
  const parsedOff = parseProfileForm(unchecked);
  assert.equal(parsedOff.success, true);
  if (parsedOff.success) {
    assert.equal(parsedOff.data.bookingEnabled, false);
  }
});
