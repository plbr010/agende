import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "professional-photo-editor.tsx"), "utf8");

test("professional photo editor previews, replaces and removes without inventing a public file", () => {
  assert.match(source, /Adicionar ou trocar foto/);
  assert.match(source, /Remover foto/);
  assert.match(source, /Prévia da foto/);
  assert.match(source, /X-Public-Photo-Consent/);
  assert.match(source, /method: file \? "PUT" : "DELETE"/);
  assert.match(source, /PersonMark/);
  assert.match(source, /Foto removida/);
  assert.match(source, /Não foi possível salvar/);
  assert.doesNotMatch(source, /setAppointmentStatusAction/);
  assert.equal(source.match(/type="file"/g)?.length, 1);
});
