import assert from "node:assert/strict";
import test from "node:test";
import { discoveryHref, discoveryInputFromUrl, discoveryStateFromQuery } from "./url";

test("city and professional name stay in the public search URL", () => {
  const state = discoveryStateFromQuery({
    cidade: " Juiz de Fora ",
    uf: "mg",
    q: " Maria ",
  });
  assert.deepEqual(state, {
    mode: "city",
    city: "Juiz de Fora",
    state: "MG",
    query: "Maria",
  });
  assert.equal(discoveryHref("/descobrir", state), "/descobrir?cidade=Juiz+de+Fora&uf=MG&q=Maria");
  assert.equal(discoveryInputFromUrl(state).query, "Maria");
});

test("clearing filters returns the path without inventing a city", () => {
  const cleared = discoveryStateFromQuery({});
  assert.equal(cleared.city, "");
  assert.equal(cleared.query, "");
  assert.equal(discoveryHref("/cliente/descobrir", cleared), "/cliente/descobrir");
});

test("name-only search does not keep a leftover city in the URL", () => {
  const named = discoveryStateFromQuery({ modo: "nome", cidade: "Muriaé", q: "Aurora" });
  assert.equal(named.mode, "global");
  assert.equal(discoveryHref("/descobrir", named), "/descobrir?modo=nome&q=Aurora");
});
