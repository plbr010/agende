import assert from "node:assert/strict";
import test from "node:test";
import { checkoutAttribution, parseVisitorId, RASTREIO_SCRIPT_SRC } from "./rastreio";
import { checkoutAttributionSchema } from "../billing/stripe-contract";

test("Rastreio loads the tracker from its own deployment over HTTPS", () => {
  assert.equal(RASTREIO_SCRIPT_SRC, "https://utmify-propria-base.vercel.app/t.js");
});

test("visitor id accepts only the t.js format, raw or URL-encoded", () => {
  assert.equal(parseVisitorId("rv_0123456789abcdef"), "rv_0123456789abcdef");
  assert.equal(parseVisitorId(encodeURIComponent("rv_0123456789abcdef")), "rv_0123456789abcdef");
  for (const raw of [undefined, "", "rv_123", "rv_0123456789ABCDEF", "x_0123456789abcdef", "rv_0123456789abcdef0", "%E0%A4%A"]) {
    assert.equal(parseVisitorId(raw), null);
  }
});

test("checkout attribution merges the visitor id with the first-touch UTMs", () => {
  const acquisition = encodeURIComponent(JSON.stringify({
    utm_source: "FB", utm_campaign: "Agendê Teste|120200000000000001", utm_medium: "Conjunto|120200000000000002",
    utm_content: "Anúncio 1|120200000000000003", utm_term: "Instagram_Feed", landing: "/", evil: "x",
  }));
  const result = checkoutAttribution({ visitor: "rv_0123456789abcdef", acquisition });
  assert.deepEqual(result, {
    utm_source: "FB", utm_campaign: "Agendê Teste|120200000000000001", utm_medium: "Conjunto|120200000000000002",
    utm_content: "Anúncio 1|120200000000000003", utm_term: "Instagram_Feed", landing: "/", vid: "rv_0123456789abcdef",
  });
  assert.ok(checkoutAttributionSchema.safeParse(result).success);
  assert.deepEqual(checkoutAttribution({ visitor: "rv_0123456789abcdef" }), { vid: "rv_0123456789abcdef" });
  assert.equal(checkoutAttribution({}), undefined);
  assert.equal(checkoutAttribution({ visitor: "bad", acquisition: "not-json" }), undefined);
});
