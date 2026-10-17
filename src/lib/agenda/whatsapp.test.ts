import assert from "node:assert/strict";
import { test } from "node:test";
import { appointmentWhatsAppMessage, internationalPhoneDigits, type WhatsAppAppointment } from "./whatsapp";
import { buildWhatsAppLink } from "@/lib/booking/calendar";
const appointment: WhatsAppAppointment = {
  clientName: "Maria da Silva", phone: "+55 (32) 99999-9999", workspaceName: "Salão Açúcar & Cia",
  serviceName: "Corte + escova", professionalName: "Ana", startsAt: "2026-10-17T01:30:00Z",
  timezone: "America/Sao_Paulo", status: "confirmed",
};
test("WhatsApp requires explicit international number and never infers country or DDD", () => {
  for (const input of [null, undefined, "", "32999999999", "5532999999999", "+0123456789", "+999123456789", "+123", "+1234567890123456", "+55<script>32999999999", "tel:+5532999999999"]) assert.equal(internationalPhoneDigits(input), null, String(input));
  assert.equal(internationalPhoneDigits(appointment.phone), "5532999999999");
  assert.equal(internationalPhoneDigits("+1 (213) 373-4253"), "12133734253");
});
test("confirmed message contains current professional, service and local date/time with encoded accents and emoji", () => {
  const message = appointmentWhatsAppMessage(appointment);
  assert.match(message, /Olá, Maria! 💗/);
  assert.match(message, /está confirmado!/);
  assert.match(message, /16 de outubro de 2026/);
  assert.match(message, /22:30/);
  assert.match(message, /👩 Profissional: Ana/);
  assert.match(message, /Corte \+ escova/);
  const url = buildWhatsAppLink(appointment.phone, message)!;
  assert.ok(url.startsWith("https://wa.me/5532999999999?text="));
  assert.equal(new URL(url).searchParams.get("text"), message);
  assert.ok(url.includes("%F0%9F%92%97"));
  assert.equal(buildWhatsAppLink("32999999999", message), null);
});
test("pending request never claims confirmation; terminal and unknown statuses are refused", () => {
  assert.match(appointmentWhatsAppMessage({ ...appointment, status: "scheduled" }), /ainda aguarda confirmação/);
  assert.match(appointmentWhatsAppMessage({ ...appointment, status: "scheduled" }), /👩 Profissional: Ana/);
  assert.doesNotMatch(appointmentWhatsAppMessage({ ...appointment, status: "scheduled" }), /está confirmado!/);
  for (const status of ["cancelled", "completed", "no_show", "in_progress", "pending"]) {
    assert.throws(() => appointmentWhatsAppMessage({ ...appointment, status } as WhatsAppAppointment));
  }
});
test("rescheduled message uses new instant and timezone; names cannot inject message lines", () => {
  const message = appointmentWhatsAppMessage({ ...appointment, startsAt: "2026-10-18T15:00:00Z", timezone: "America/Manaus", clientName: "Maria\n*confirmado*" });
  assert.match(message, /18 de outubro/); assert.match(message, /11:00/);
  assert.equal(message.split("\n")[0], "Olá, Maria! 💗");
});
