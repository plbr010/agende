import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClientProfileForm } from "./client-profile-form";

test("legacy schema form omits unsupported city while keeping core profile editable", () => {
  const props = { fullName: "Cliente", phone: "+5532999991234", email: "client@example.invalid" };
  const legacy = renderToStaticMarkup(createElement(ClientProfileForm, { ...props, residenceCityAvailable: false }));
  assert.match(legacy, /name="fullName"/);assert.match(legacy, /name="phone"/);
  assert.doesNotMatch(legacy, /name="residenceCity"/);
  const current = renderToStaticMarkup(createElement(ClientProfileForm, { ...props, residenceCityAvailable: true }));
  assert.match(current, /name="residenceCity"/);assert.match(current, /Opcional/);
});
