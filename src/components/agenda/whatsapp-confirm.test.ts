import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

test("whatsapp confirmation never changes the appointment status", () => {
  const button = readFileSync(join(root, "whatsapp-confirm.tsx"), "utf8");
  const board = readFileSync(join(root, "agenda-board.tsx"), "utf8");
  assert.doesNotMatch(button, /setAppointmentStatusAction/);
  assert.match(button, /Confirmar pelo WhatsApp/);
  assert.match(button, /Copiar mensagem/);
  assert.match(button, /status do horário não muda/);
  assert.match(board, /WhatsAppConfirm/);
  assert.match(board, /buildWhatsAppConfirmation/);
  assert.match(board, /Avisar a cliente/);
});
