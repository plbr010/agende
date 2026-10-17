import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

test("whatsapp confirmation never changes the appointment status", () => {
  const button = readFileSync(join(root, "appointment-whatsapp.tsx"), "utf8");
  const board = readFileSync(join(root, "agenda-board.tsx"), "utf8");
  assert.doesNotMatch(button, /setAppointmentStatusAction/);
  assert.match(button, /Confirmar pelo WhatsApp/);
  assert.match(button, /Avisar pelo WhatsApp/);
  assert.match(button, /\/api\/appointments\/whatsapp\?id=/);
  assert.doesNotMatch(button, /https:\/\/wa\.me/);
  assert.match(button, /Copiar mensagem/);
  assert.match(button, /não altera o agendamento/);
  assert.match(board, /AppointmentWhatsApp/);
  assert.match(button, /prepareAppointmentWhatsApp/);
  assert.match(board, /Avisar a cliente/);
  assert.match(board, /appointment\.clientName/);
  assert.match(board, /displayClientPhone\(appointment\.clientPhone\)/);
  assert.match(board, /Não há confirmação pelo WhatsApp/);
});
