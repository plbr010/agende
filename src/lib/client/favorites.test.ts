import assert from "node:assert/strict";
import test from "node:test";
import {
  favoriteActionMessage,
  favoritesViewFromLoad,
  parseWorkspaceFavorites,
  readPublicWorkspaceId,
} from "./favorites";

const id = "11111111-1111-4111-8111-111111111111";

test("favorites parse only explicit workspace ids and keep empty distinct from invalid", () => {
  assert.equal(readPublicWorkspaceId({ name: "Luna", slug: "luna" }), null);
  assert.equal(readPublicWorkspaceId({ workspace_id: "not-an-id" }), null);
  assert.equal(readPublicWorkspaceId({ id }), null);
  assert.equal(readPublicWorkspaceId({ workspace_id: id }), id);

  const parsed = parseWorkspaceFavorites({
    items: [{ workspace_id: id, name: "Luna", slug: "luna", city: "Juiz de Fora", state: "MG", logo_path: null }],
    total: 1,
  });
  assert.equal(parsed?.items[0]?.workspaceId, id);
  assert.equal(parseWorkspaceFavorites({ items: [], total: 0 })?.items.length, 0);
  assert.equal(parseWorkspaceFavorites({ items: [{ name: "Luna" }], total: 1 }), null);
  assert.deepEqual(favoritesViewFromLoad({ data: null, error: "favorites_unavailable" }), { status: "error", items: [] });
  assert.equal(favoritesViewFromLoad({ data: { items: [], total: 0 }, error: null }).status, "ready");
});

test("favorite errors stay in plain language", () => {
  assert.match(favoriteActionMessage("missing_target"), /Ainda não dá para guardar/);
  assert.match(favoriteActionMessage("workspace_unavailable"), /não pode ser guardado/);
  assert.doesNotMatch(favoriteActionMessage("favorites_unavailable"), /PGRST|RPC|uuid/i);
});
