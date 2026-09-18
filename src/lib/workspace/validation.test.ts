import assert from "node:assert/strict";
import test from "node:test";
import { parseInviteForm, parseWorkspaceSettingsForm } from "./validation";
import { parsePublicWorkspaceProfile } from "./public";

test("settings form normalizes slug, phone, instagram and CEP", () => {
  const form = new FormData();
  form.set("name", "Studio Luna");
  form.set("slug", "Meu Salão");
  form.set("businessPhone", "(32) 99999-9999");
  form.set("businessEmail", "Studio@Example.com");
  form.set("instagram", "@luna.studio");
  form.set("postalCode", "36010-041");
  form.set("state", "mg");
  form.set("timezone", "America/Manaus");
  const parsed = parseWorkspaceSettingsForm(form);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.slug, "meu-salao");
    assert.equal(parsed.data.businessPhone, "+5532999999999");
    assert.equal(parsed.data.businessEmail, "studio@example.com");
    assert.equal(parsed.data.instagram, "luna.studio");
    assert.equal(parsed.data.postalCode, "36010041");
    assert.equal(parsed.data.state, "MG");
    assert.equal(parsed.data.timezone, "America/Manaus");
  }
});

test("reserved slug is rejected in the form", () => {
  const form = new FormData();
  form.set("name", "Studio");
  form.set("slug", "app");
  const parsed = parseWorkspaceSettingsForm(form);
  assert.equal(parsed.success, false);
});

test("invite without email is a secret link; owner role is rejected", () => {
  const secret = new FormData();
  secret.set("role", "professional");
  const parsedSecret = parseInviteForm(secret);
  assert.equal(parsedSecret.success, true);
  if (parsedSecret.success) {
    assert.equal(parsedSecret.data.email, null);
  }

  const owner = new FormData();
  owner.set("role", "owner");
  const parsedOwner = parseInviteForm(owner);
  assert.equal(parsedOwner.success, false);
});

test("public profile parser keeps only public fields", () => {
  const parsed = parsePublicWorkspaceProfile({
    name: "Luna",
    slug: "luna",
    description: "Studio",
    city: "Juiz de Fora",
    state: "MG",
    instagram: "luna.studio",
    logo_path: null,
    email: "hidden@example.com",
    services: [
      {
        name: "Corte",
        description: "Corte feminino",
        duration_minutes: 45,
        price_cents: 8000,
        min_price_cents: 7000,
        max_price_cents: 9000,
      },
    ],
    professionals: [{ display_name: "Ana", bio: "Hair", services: ["Corte"] }],
  });
  assert.ok(parsed);
  assert.equal(parsed?.name, "Luna");
  assert.equal("email" in (parsed ?? {}), false);
  assert.equal(parsed?.services[0]?.min_price_cents, 7000);
});
