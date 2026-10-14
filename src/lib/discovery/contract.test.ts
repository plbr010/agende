import assert from "node:assert/strict";
import test from "node:test";
import {
  DISCOVERY_BACKEND_READY,
  DISCOVERY_COPY,
  DISCOVERY_RPCS,
  discoveryRpcArgs,
  discoverySearchBlockedReason,
  discoverySearchNeedsLocality,
  isMissingDiscoveryContract,
  normalizeDiscoverySearch,
  parseDiscoverySearchPayload,
  parseDiscoveryWorkspaceCard,
  searchPublicWorkspaces,
  searchPublicWorkspacesWithRpc,
} from "./contract";
import { parseReverseGeocodePayload } from "./geocode";

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

test("global search does not require a city and nearby does not use residence", () => {
  assert.equal(discoverySearchBlockedReason({ mode: "global", query: "Aurora" }), null);
  assert.equal(discoverySearchNeedsLocality({ mode: "global", query: "Aurora" }), false);
  assert.match(discoverySearchBlockedReason({ mode: "global" }) ?? "", /nome/i);
  assert.equal(
    discoverySearchBlockedReason({
      mode: "nearby",
      coordinates: { latitude: -21.76, longitude: -43.35 },
    }),
    null,
  );
  const nearby = normalizeDiscoverySearch({
    mode: "nearby",
    coordinates: { latitude: -21.76444, longitude: -43.34999 },
    city: "",
  });
  assert.equal(nearby.city, undefined);
  assert.equal(nearby.coordinates?.latitude, -21.764);
  assert.equal(normalizeDiscoverySearch({ mode: "city", coordinates: nearby.coordinates }).coordinates, undefined);
});

test("parser maps the Codex wire DTO and never invents a salon", () => {
  assert.equal(parseDiscoveryWorkspaceCard({ name: "X" }), null);
  assert.equal(parseDiscoveryWorkspaceCard({ slug: "bad slug", name: "X" }), null);
  const card = parseDiscoveryWorkspaceCard({
    name: "Studio Aurora",
    slug: "studio-aurora",
    description: null,
    city: "Juiz de Fora",
    state: "mg",
    logo_path: "logo.png",
    booking_open: true,
  });
  assert.deepEqual(card, {
    name: "Studio Aurora",
    slug: "studio-aurora",
    description: null,
    city: "Juiz de Fora",
    state: "MG",
    logoPath: "logo.png",
    bookingOpen: true,
  });
  const parsed = parseDiscoverySearchPayload({
    items: [{ name: "Ok", slug: "ok-salon", booking_open: false }, { name: "drop-me" }],
    total: 9,
  });
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.total, 9);
  assert.equal(parsed.items[0]?.bookingOpen, false);
});

test("adapter probes the real RPC names and stays empty when the backend is missing", async () => {
  assert.equal(DISCOVERY_BACKEND_READY, false);
  assert.equal(DISCOVERY_RPCS.searchWorkspaces, "search_public_workspaces");
  assert.equal(DISCOVERY_RPCS.listLocalities, "list_public_localities");
  assert.equal(isMissingDiscoveryContract({ code: "PGRST202", message: "schema cache" }), true);

  const missing = await searchPublicWorkspacesWithRpc(async () => ({
    data: null,
    error: { code: "PGRST202", message: "could not find the function" },
  }), { city: "Juiz de Fora", state: "MG" });
  assert.equal(missing.status, "unavailable");
  assert.deepEqual(missing.items, []);

  const args = discoveryRpcArgs({ city: "Recife", state: "PE", query: "corte", coordinates: { latitude: 1, longitude: 1 } });
  assert.equal(args.p_city, "Recife");
  assert.equal("p_latitude" in args, false);

  const ready = await searchPublicWorkspacesWithRpc(async (name, payload) => {
    assert.equal(name, "search_public_workspaces");
    assert.equal(payload.p_city, null);
    assert.equal(payload.p_query, "Aurora");
    return {
      data: { items: [{ name: "Aurora", slug: "aurora-studio", city: "Recife", state: "PE", booking_open: true }], total: 1 },
      error: null,
    };
  }, { mode: "global", query: "Aurora" });
  assert.equal(ready.status, "ready");
  if (ready.status === "ready") {
    assert.equal(ready.items[0]?.slug, "aurora-studio");
    assert.equal(ready.items[0]?.bookingOpen, true);
  }

  const closed = await searchPublicWorkspaces({ city: "Juiz de Fora", state: "MG" });
  assert.equal(closed.status, "unavailable");
  assert.deepEqual(closed.items, []);
});

test("reverse geocode maps a Brazilian city without using residence", () => {
  const parsed = parseReverseGeocodePayload({
    city: "Belo Horizonte",
    locality: "Centro",
    principalSubdivisionCode: "BR-MG",
    countryCode: "BR",
  });
  assert.deepEqual(parsed, { city: "Belo Horizonte", state: "MG" });
  assert.equal(parseReverseGeocodePayload({ locality: "x" }), null);
});
