import test from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_SITEMAP_PATHS, publicSiteOrigin } from "./seo";

test("site origin falls back to production and strips paths", () => {
  assert.equal(publicSiteOrigin({}), "https://agendeapp.online");
  assert.equal(publicSiteOrigin({ NEXT_PUBLIC_SITE_URL: "https://agendeapp.online/" }), "https://agendeapp.online");
  assert.equal(publicSiteOrigin({ NEXT_PUBLIC_SITE_URL: "not a url" }), "https://agendeapp.online");
});

test("sitemap lists only public pages", () => {
  for (const { path } of PUBLIC_SITEMAP_PATHS) {
    assert.ok(!/^\/(app|admin|cliente|onboarding|api|auth)(\/|$)/.test(path), path);
  }
});
