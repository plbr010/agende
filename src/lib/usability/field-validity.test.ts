import assert from "node:assert/strict";
import test from "node:test";
import { REQUIRED_FIELD_MESSAGE, applyPortugueseValidity } from "./field-validity";

function fakeField(partial: Partial<ValidityState> & { type?: string; minLength?: number }) {
  let message = "";
  const field = {
    type: partial.type ?? "text",
    minLength: partial.minLength ?? 0,
    validity: {
      valueMissing: Boolean(partial.valueMissing),
      typeMismatch: Boolean(partial.typeMismatch),
      tooShort: Boolean(partial.tooShort),
    },
    setCustomValidity(value: string) {
      message = value;
    },
    get message() {
      return message;
    },
  };
  return field;
}

test("empty required fields explain the next step in Portuguese", () => {
  const field = fakeField({ valueMissing: true });
  applyPortugueseValidity(field);
  assert.equal(field.message, REQUIRED_FIELD_MESSAGE);
});

test("invalid emails tell the person what a valid address looks like", () => {
  const field = fakeField({ type: "email", typeMismatch: true });
  applyPortugueseValidity(field);
  assert.match(field.message, /e-mail válido/);
});
