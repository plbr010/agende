import assert from "node:assert/strict";
import test from "node:test";
import {
  extractPublicWorkspaceSlug,
  formatPublicProfilePreview,
  isReservedWorkspaceSlug,
  slugError,
  slugifyPreview,
} from "./slug";

test("slugifyPreview lowercases, strips accents and spaces", () => {
  assert.equal(slugifyPreview("Meu Salão"), "meu-salao");
  assert.equal(slugifyPreview("  Studio  Luna  "), "studio-luna");
  assert.equal(slugifyPreview("A&B"), "a-b");
});

test("reserved slugs stay blocked including public routes", () => {
  assert.equal(isReservedWorkspaceSlug("app"), true);
  assert.equal(isReservedWorkspaceSlug("p"), true);
  assert.equal(isReservedWorkspaceSlug("convite"), true);
  assert.equal(isReservedWorkspaceSlug("configuracoes"), true);
  assert.equal(isReservedWorkspaceSlug("meu-salao"), false);
});

test("slugError enforces length, charset and reserved words", () => {
  assert.ok(slugError("ab"));
  assert.ok(slugError("has space"));
  assert.ok(slugError("Maiuscula"));
  assert.ok(slugError("app"));
  assert.equal(slugError("meu-salao"), null);
});

test("extractPublicWorkspaceSlug accepts slugs and public profile URLs only", () => {
  assert.equal(extractPublicWorkspaceSlug("luna"), "luna");
  assert.equal(extractPublicWorkspaceSlug("  Studio-Ana  "), "studio-ana");
  assert.equal(extractPublicWorkspaceSlug("/p/studio-luna"), "studio-luna");
  assert.equal(extractPublicWorkspaceSlug("https://agende.app/p/studio-luna/agendar"), "studio-luna");
  assert.equal(extractPublicWorkspaceSlug("agende.app/p/meu-salao?utm=bio"), "meu-salao");
  assert.equal(extractPublicWorkspaceSlug("ab"), null);
  assert.equal(extractPublicWorkspaceSlug("app"), null);
  assert.equal(extractPublicWorkspaceSlug(""), null);
});

test("preview uses the current host without a hardcoded domain", () => {
  assert.equal(formatPublicProfilePreview("localhost:3000", "luna"), "localhost:3000/p/luna");
  assert.equal(formatPublicProfilePreview("https://agende.com/", "luna"), "agende.com/p/luna");
});
