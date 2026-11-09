import test from "node:test";
import assert from "node:assert/strict";
import { acquisitionFromUrl, isPageViewPath, parseAcquisitionCookie, pixelEnabled } from "./meta-pixel";

test("pixel reports only from the production deployment", () => {
  assert.equal(pixelEnabled("production"), true);
  assert.equal(pixelEnabled("preview"), false);
  assert.equal(pixelEnabled("development"), false);
  assert.equal(pixelEnabled(undefined), false);
});

test("page views cover marketing pages and never private or token-bearing paths", () => {
  for (const path of ["/", "/profissionais", "/demo", "/demo/painel/agenda", "/cadastro"]) assert.ok(isPageViewPath(path), path);
  for (const path of ["/app", "/app/agenda", "/admin", "/cliente", "/convite/abc", "/auth/confirm", "/redefinir-senha", "/p/studio", "/demonstracao"]) {
    assert.ok(!isPageViewPath(path), path);
  }
});

test("acquisition keeps safe utm values and the marketing landing path only", () => {
  const acq = acquisitionFromUrl(new URL("https://agendeapp.online/profissionais?utm_source=instagram&utm_campaign=a_dor&utm_content=<script>&x=1"));
  assert.deepEqual(acq, { utm_source: "instagram", utm_campaign: "a_dor", landing: "/profissionais" });
  assert.equal(acquisitionFromUrl(new URL("https://agendeapp.online/profissionais")), null);
  assert.deepEqual(acquisitionFromUrl(new URL("https://agendeapp.online/convite/tok?utm_source=ig")), { utm_source: "ig" });
});

test("acquisition cookie parsing drops unknown keys and malformed input", () => {
  const raw = encodeURIComponent(JSON.stringify({ utm_source: "instagram", evil: "x", utm_term: 5 }));
  assert.deepEqual(parseAcquisitionCookie(raw), { utm_source: "instagram" });
  assert.equal(parseAcquisitionCookie("%%%"), null);
  assert.equal(parseAcquisitionCookie(undefined), null);
});
