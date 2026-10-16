import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWhatsAppConfirmation,
  formatAppointmentDateLabel,
  professionalConfirmationMessage,
} from "./whatsapp-confirmation";

const sample = {
  clientName: "Maria Clara",
  workspaceName: "Luna",
  serviceName: "Manicure",
  professionalName: "Ana",
  localDate: "2026-10-16",
  localTime: "14:30",
};

test("confirmation message follows the salon template", () => {
  assert.equal(formatAppointmentDateLabel("2026-10-16"), "16 de outubro de 2026");
  assert.equal(
    professionalConfirmationMessage(sample),
    [
      "Olá, Maria! 💗",
      "",
      "Seu agendamento no *Luna* está confirmado!",
      "",
      "✨ Serviço: Manicure",
      "👩 Profissional: Ana",
      "📅 Data: 16 de outubro de 2026",
      "🕒 Horário: 14:30",
      "",
      "Estamos te esperando! 💕",
    ].join("\n"),
  );
});

test("whatsapp opens only for a real phone and never for a cancelled visit", () => {
  const ready = buildWhatsAppConfirmation({ ...sample, status: "scheduled", phone: "(32) 99999-9999" });
  assert.equal(ready.mode, "send");
  if (ready.mode === "send") {
    assert.match(ready.href, /^https:\/\/wa\.me\/5532999999999\?text=/);
    assert.doesNotMatch(ready.href, /confirmed=true/);
    assert.match(ready.message, /ainda aguarda confirmação/);
    assert.doesNotMatch(ready.message, /está confirmado/);
  }

  const confirmed = buildWhatsAppConfirmation({ ...sample, status: "confirmed", phone: "+5532999999999" });
  assert.equal(confirmed.mode, "send");

  const missing = buildWhatsAppConfirmation({ ...sample, status: "scheduled", phone: "123" });
  assert.equal(missing.mode, "copy-only");
  if (missing.mode === "copy-only") {
    assert.match(missing.guidance, /celular válido/);
    assert.match(missing.message, /Manicure/);
  }

  for (const status of ["cancelled", "no_show", "completed", "in_progress"] as const) {
    const blocked = buildWhatsAppConfirmation({ ...sample, status, phone: "+5532999999999" });
    assert.equal(blocked.mode, "blocked", status);
    if (blocked.mode === "blocked") {
      assert.doesNotMatch(blocked.guidance, /está confirmado/);
    }
  }
});
