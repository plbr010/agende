import assert from "node:assert/strict";
import test from "node:test";
import { mapAgendaError, slotQueryMessage } from "./errors";

test("expired entitlement stays specific even when the SQLSTATE is attached", () => {
  const message = mapAgendaError("workspace_subscription_inactive (42501)");
  assert.match(message, /não está ativo/i);
  assert.equal(message.includes("permissão"), false);
});

test("a paused agenda is not described as a day without free hours", () => {
  assert.match(slotQueryMessage("booking_creation_paused", 0), /não está aberta para novos agendamentos/i);
  assert.match(slotQueryMessage("workspace_subscription_inactive", 0), /não está ativo/i);
  assert.equal(slotQueryMessage(null, 0), "Nenhum horário livre neste dia.");
  assert.equal(slotQueryMessage(null, 2), null);
});

test("a closed agenda and a missing permission keep their own messages", () => {
  assert.match(mapAgendaError("booking_creation_paused"), /não está aberta para novos agendamentos/i);
  assert.match(mapAgendaError("not_authorized"), /não tem permissão/i);
  assert.equal(mapAgendaError("something unexpected sql"), "Não deu certo salvar. Tente de novo.");
});
