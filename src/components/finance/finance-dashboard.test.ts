import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "finance-dashboard.tsx"), "utf8");

test("finance actions use everyday money words instead of accounting jargon", () => {
  assert.match(source, /Adicionar dinheiro que entrou/);
  assert.match(source, /Marcar como pago/);
  assert.match(source, /Quanto sobrou/);
  assert.doesNotMatch(source, /Dar baixa/);
  assert.doesNotMatch(source, /Salvar lançamento/);
  assert.doesNotMatch(source, /Saldo líquido/);
});
