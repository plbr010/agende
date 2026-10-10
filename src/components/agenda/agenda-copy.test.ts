import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));

test("agenda dialogs tell the professional what to do next in plain language", () => {
  const source = readFileSync(join(dir, "agenda-board.tsx"), "utf8");
  assert.match(source, /Novo horário/);
  assert.match(source, /STATUS_ACTION_LABEL/);
  assert.match(source, /Os horários livres aparecem aqui/);
  assert.doesNotMatch(source, /calculados no servidor/);
  assert.doesNotMatch(source, /encaixar uma cliente/);
});

test("working hours editor collapses empty days and can copy a day to the rest of the week", () => {
  const source = readFileSync(join(dir, "availability-editor.tsx"), "utf8");
  assert.match(source, /Horários de trabalho/);
  assert.match(source, /Usar estes horários nos outros dias/);
  assert.match(source, /Folga — toque para definir/);
  assert.match(source, />De</);
  assert.match(source, />Até</);
  assert.match(source, /ConfirmAction/);
  assert.doesNotMatch(source, /window\.confirm/);
  assert.doesNotMatch(source, /interpretadas em São Paulo/);
});
