import assert from "node:assert/strict";
import test from "node:test";
import { specialistWhatsAppHref, SPECIALIST_MESSAGE } from "./whatsapp";
test("commercial WhatsApp validates explicit Brazilian destinations and preserves the exact message", () => {
  for (const invalid of [undefined, "", "32999999999", "+5532999999999", "55", "https://evil.test", "5500999999999", "553299999999999"]) assert.equal(specialistWhatsAppHref(invalid), null);
  const url = new URL(specialistWhatsAppHref("5532999999999")!);
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/5532999999999");
  assert.equal(url.searchParams.get("text"), SPECIALIST_MESSAGE);
});

test("commercial button hides missing configuration and renders safe accessible external contact", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { SpecialistWhatsApp } = await import("../../components/marketing/specialist-whatsapp");
  const before = process.env.NEXT_PUBLIC_AGENDE_WHATSAPP_NUMBER;
  try {
    delete process.env.NEXT_PUBLIC_AGENDE_WHATSAPP_NUMBER;
    assert.equal(renderToStaticMarkup(createElement(SpecialistWhatsApp)), "");
    process.env.NEXT_PUBLIC_AGENDE_WHATSAPP_NUMBER = "invalid";
    assert.equal(renderToStaticMarkup(createElement(SpecialistWhatsApp)), "");
    process.env.NEXT_PUBLIC_AGENDE_WHATSAPP_NUMBER = "5532999999999";
    const html = renderToStaticMarkup(createElement(SpecialistWhatsApp));
    assert.match(html, /Fale com um especialista/); assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/); assert.match(html, /<svg/);
  } finally {
    if (before === undefined) delete process.env.NEXT_PUBLIC_AGENDE_WHATSAPP_NUMBER;
    else process.env.NEXT_PUBLIC_AGENDE_WHATSAPP_NUMBER = before;
  }
});
