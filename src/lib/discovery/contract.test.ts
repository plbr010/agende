import assert from "node:assert/strict";
import test from "node:test";
import {
  DISCOVERY_BACKEND_READY,
  DISCOVERY_COPY,
  DISCOVERY_RPCS,
  discoverySearchNeedsLocality,
  normalizeDiscoverySearch,
  searchPublicWorkspaces,
} from "./contract";

test("discovery never defaults to a residence city", () => {
  const empty = normalizeDiscoverySearch({});
  assert.equal(empty.city, undefined);
  assert.equal(empty.state, undefined);
  assert.equal(discoverySearchNeedsLocality({}), true);
  assert.equal(discoverySearchNeedsLocality({ city: "São Paulo", state: "SP" }), false);
});

test("a person can search any registered locality, not only where they live", () => {
  const farFromHome = normalizeDiscoverySearch({
    city: "  Salvador ",
    state: "ba",
    query: "manicure",
  });
  assert.equal(farFromHome.city, "Salvador");
  assert.equal(farFromHome.state, "BA");
  assert.match(DISCOVERY_COPY.description, /qualquer cidade/i);
  assert.doesNotMatch(DISCOVERY_COPY.description, /cidade onde você mora obrigat/i);
});

test("search does not invent establishments while the backend is missing", async () => {
  assert.equal(DISCOVERY_BACKEND_READY, false);
  const result = await searchPublicWorkspaces({ city: "Juiz de Fora", state: "MG" });
  assert.equal(result.status, "unavailable");
  assert.deepEqual(result.items, []);
  assert.equal(DISCOVERY_RPCS.searchWorkspaces, "search_public_workspaces");
  assert.equal(DISCOVERY_RPCS.listLocalities, "list_public_localities");
});
