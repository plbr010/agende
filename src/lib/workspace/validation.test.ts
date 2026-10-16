import assert from "node:assert/strict";
import test from "node:test";
import { parseInviteForm, parseWorkspaceSettingsForm } from "./validation";
import { bookablePublicServices, parsePublicWorkspaceProfile } from "./public";

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

test("omitted optional settings fields become null", () => {
  const form = new FormData();
  form.set("name", "Studio Luna");
  form.set("slug", "luna-studio");
  const parsed = parseWorkspaceSettingsForm(form);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.businessPhone, null);
    assert.equal(parsed.data.businessEmail, null);
    assert.equal(parsed.data.instagram, null);
    assert.equal(parsed.data.postalCode, null);
    assert.equal(parsed.data.state, null);
    assert.equal(parsed.data.address, null);
    assert.equal(parsed.data.timezone, "America/Sao_Paulo");
  }
});

test("reserved slug is rejected in the form", () => {
  const form = new FormData();
  form.set("name", "Studio");
  form.set("slug", "app");
  const parsed = parseWorkspaceSettingsForm(form);
  assert.equal(parsed.success, false);
});

test("invalid optional commercial fields are rejected instead of silently discarded", () => {
  for (const [key, value] of [["state", "ZZ"], ["timezone", "Mars/Nowhere"], ["postalCode", "abc"], ["address", "a".repeat(161)], ["city", "A"]]) {
    const form = new FormData(); form.set("name", "Studio"); form.set("slug", "studio"); form.set(key, value);
    const parsed = parseWorkspaceSettingsForm(form);
    assert.equal(parsed.success, false, key);
    if (!parsed.success) assert.ok(parsed.error.issues.some(issue => issue.path[0] === key));
  }
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
    address: "Rua das Flores, 10",
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
  assert.equal(parsed?.address, "Rua das Flores, 10");
  assert.equal(parsed?.services[0]?.id, null);
});

test("public profile keeps a real average and public photos, and drops the rest", () => {
  const missing = parsePublicWorkspaceProfile({
    name: "Luna",
    slug: "luna",
    average_rating: 4.9,
    photos: ["javascript:alert(1)", "https://cdn.example.com/salao.webp", { url: "nota-url" }],
  });
  assert.equal(missing?.averageRating, null);
  assert.equal(missing?.reviewCount, null);
  assert.equal(missing?.photos.length, 1);
  assert.equal(missing?.photos[0]?.url, "https://cdn.example.com/salao.webp");
  assert.equal(missing?.photos[0]?.alt, null);

  const published = parsePublicWorkspaceProfile({
    name: "Luna",
    slug: "luna",
    average_rating: 4.74,
    review_count: 12,
    gallery: [{ path: "https://cdn.example.com/recepcao.webp", alt: "Recepção" }],
  });
  assert.equal(published?.averageRating, 4.7);
  assert.equal(published?.reviewCount, 12);
  assert.equal(published?.photos[0]?.alt, "Recepção");
  assert.equal(parsePublicWorkspaceProfile({ name: "Luna", slug: "luna", rating_average: 5, rating_count: 0 })?.averageRating, null);
});

test("bookablePublicServices hides services without a published professional", () => {
  const profile = parsePublicWorkspaceProfile({
    name: "Luna",
    slug: "luna",
    services: [
      { id: "11111111-1111-4111-8111-111111111111", name: "Corte", duration_minutes: 45, price_cents: 8000 },
      { id: "22222222-2222-4222-8222-222222222222", name: "Coloração", duration_minutes: 90, price_cents: 18000 },
    ],
    professionals: [{ display_name: "Ana", bio: null, services: ["Corte"] }],
  });
  assert.ok(profile);
  const bookable = bookablePublicServices(profile!);
  assert.deepEqual(bookable.map((service) => service.name), ["Corte"]);
});
