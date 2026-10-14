import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));

function source(name: string) {
  return readFileSync(join(dir, name), "utf8");
}

test("publication form keeps a native checkbox, announces errors and resets after save", () => {
  const form = source("publication-form.tsx");
  assert.match(form, /type="checkbox"/);
  assert.match(form, /name="enabled"/);
  assert.match(form, /key=\{String\(enabled\)\}/);
  assert.match(form, /role="alert"/);
  assert.match(form, /role="status"/);
  assert.match(form, /PortugueseForm/);
  assert.match(form, /min-h-11/);
  assert.doesNotMatch(form, /role="status".*state\.error/);
});

test("perfil explains when discovery publication RPC is missing instead of hiding the block", () => {
  const page = readFileSync(join(dir, "../../app/app/configuracoes/perfil/page.tsx"), "utf8");
  assert.match(page, /DiscoveryPublicationUnavailable/);
  assert.match(page, /publication\?\.error/);
  const notice = source("discovery-unavailable.tsx");
  assert.match(notice, /ainda não está disponível/);
  assert.doesNotMatch(notice, /set_workspace_discovery/);
});

test("publication action never leaks raw RPC text and handles a missing contract", () => {
  const action = readFileSync(join(dir, "../../lib/discovery/publication.ts"), "utf8");
  assert.match(action, /error\.message \?\? ""/);
  assert.match(action, /PGRST202/);
  assert.match(action, /discovery_locality_required/);
  assert.doesNotMatch(action, /return \{ error: error\.message/);
});
