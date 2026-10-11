import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

function source(path: string) {
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), path), "utf8");
}

test("sensitive saves ask inside the page and keep the form", () => {
  const form = source("../modules/management-form.tsx");
  assert.doesNotMatch(form, /window\.confirm/);
  assert.match(form, /DialogTitle/);
  assert.match(form, /Voltar/);
  assert.match(form, /requestSubmit/);
  assert.match(form, /preventDefault/);
  assert.match(form, /o que você já preencheu continua/);
});

test("stock, packages and reschedule speak in everyday words", () => {
  const inventory = source("../inventory/inventory-dashboard.tsx");
  assert.match(inventory, /Chegou produto/);
  assert.match(inventory, /Saiu produto/);
  assert.match(inventory, /Corrigir a quantidade/);
  assert.match(inventory, /quanto deve ficar no estoque/);
  assert.doesNotMatch(inventory, /Registrar movimentação/);

  const packages = source("../packages/packages-dashboard.tsx");
  assert.match(packages, /As sessões que ainda não foram usadas deixam de valer/);
  assert.match(packages, /min-h-11 items-center/);
  assert.doesNotMatch(packages, /situação financeira/);

  const reschedule = source("../booking/reschedule-dialog.tsx");
  assert.match(reschedule, /Não deu certo carregar quem atende/);
  assert.match(reschedule, /Não deu certo ver os horários/);
  assert.doesNotMatch(reschedule, /Falha ao/);
});

test("cancel errors stay inside the open dialog and primary taps are large", () => {
  const appointments = source("../booking/client-appointments.tsx");
  const title = appointments.indexOf("Cancelar horário?");
  const confirm = appointments.indexOf("Confirmar cancelamento");
  const alert = appointments.indexOf('role="alert"', title);
  assert.ok(title >= 0 && alert > title && alert < confirm);

  const directories = source("../catalog/directories.tsx");
  assert.doesNotMatch(directories, /size="sm"/);
  assert.match(directories, /className="h-11"/);

  const agenda = source("../agenda/agenda-board.tsx");
  assert.match(agenda, /h-11 w-full justify-start/);
  assert.doesNotMatch(agenda, /underline underline-offset-4/);

  const client = source("../client/client-shell.tsx");
  assert.match(client, /min-h-11/);
  assert.match(client, /size-11 rounded-full sm:hidden/);
  assert.doesNotMatch(client, /size="sm" className="hidden/);
  assert.doesNotMatch(client, /flex h-9 /);

  const reviews = source("../reviews/review-center.tsx");
  assert.match(reviews, /size-11 shrink-0/);
});
