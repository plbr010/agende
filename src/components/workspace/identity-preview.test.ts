import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IdentityPreview } from "./identity-preview";

test("identity preview shows the published cover, logo and an empty fallback", () => {
  const filled = renderToStaticMarkup(
    createElement(IdentityPreview, {
      name: "Luna",
      description: "Studio de unha.",
      logoUrl: "https://cdn.example.com/logo.webp",
      coverUrl: "https://cdn.example.com/capa.webp",
      publicHref: "/p/luna",
    }),
  );
  assert.match(filled, /Como as clientes veem/);
  assert.match(filled, /Capa publicada de Luna/);
  assert.match(filled, /Logo publicada de Luna/);
  assert.match(filled, /Studio de unha/);
  assert.match(filled, /href="\/p\/luna"/);

  const empty = renderToStaticMarkup(
    createElement(IdentityPreview, {
      name: "Luna",
      description: "  ",
      logoUrl: null,
      coverUrl: null,
      publicHref: "/p/luna",
    }),
  );
  assert.match(empty, /Foto ainda não publicada/);
  assert.match(empty, /Logo de Luna ainda não publicada/);
  assert.match(empty, /ainda não publicou uma descrição/);
});
