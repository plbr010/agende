import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicWorkspacePage } from "./public-profile";
import { parsePublicWorkspaceProfile, type PublicWorkspaceProfile } from "@/lib/workspace/public";

function profile(extra: Record<string, unknown> = {}): PublicWorkspaceProfile {
  const parsed = parsePublicWorkspaceProfile({
    name: "Luna",
    slug: "luna",
    description: "Studio de unha e cabelo.",
    address: "Rua das Flores, 10",
    city: "Juiz de Fora",
    state: "MG",
    instagram: "luna.studio",
    services: [
      { id: "11111111-1111-4111-8111-111111111111", name: "Manicure", description: "Esmaltação", duration_minutes: 60, price_cents: 7000, min_price_cents: 7000, max_price_cents: 7000 },
      { id: "22222222-2222-4222-8222-222222222222", name: "Escova", description: null, duration_minutes: 45, price_cents: 9000, min_price_cents: 8000, max_price_cents: 12000 },
    ],
    professionals: [
      { id: "33333333-3333-4333-8333-333333333333", display_name: "Ana Carolina", bio: "Hora marcada.", services: ["Manicure", "Escova"] },
    ],
    ...extra,
  });
  assert.ok(parsed);
  return { ...parsed, coverUrl: null };
}

test("public salon page shows real fields and an elegant empty photo", () => {
  const html = renderToStaticMarkup(createElement(PublicWorkspacePage, { profile: profile(), bookingOpen: true }));
  assert.match(html, /Foto ainda não publicada/);
  assert.match(html, /Logo de Luna ainda não publicada/);
  assert.match(html, /Luna/);
  assert.match(html, /Juiz de Fora/);
  assert.match(html, /Rua das Flores, 10/);
  assert.match(html, /Studio de unha e cabelo/);
  assert.match(html, /Manicure/);
  assert.match(html, /60 minutos/);
  assert.match(html, /Escova/);
  assert.match(html, /a partir de/);
  assert.match(html, /Ana Carolina/);
  assert.match(html, /Agendar horário/);
  assert.match(html, /\/p\/luna\/agendar\?servico=/);
  assert.doesNotMatch(html, /Galeria/);
  assert.doesNotMatch(html, /Avaliação média/);
  assert.doesNotMatch(html, /4,9/);
});

test("public salon page shows a real rating, cover and gallery only when provided", () => {
  const html = renderToStaticMarkup(createElement(PublicWorkspacePage, {
    profile: {
      ...profile({
        average_rating: 4.7,
        review_count: 3,
        photos: [{ url: "https://cdn.example.com/recepcao.webp", alt: "Recepção da Luna" }],
        logo_path: null,
      }),
      coverUrl: "https://cdn.example.com/capa.webp",
      logoUrl: "https://cdn.example.com/logo.webp",
    },
  }));
  assert.match(html, /Capa de Luna/);
  assert.match(html, /Logo de Luna/);
  assert.match(html, /Avaliação média/);
  assert.match(html, /4,7/);
  assert.match(html, /3 avaliações/);
  assert.match(html, /Galeria/);
  assert.match(html, /Recepção da Luna/);
  assert.doesNotMatch(html, /Foto ainda não publicada/);
});

test("closed public agenda keeps the profile and explains the pause", () => {
  const html = renderToStaticMarkup(createElement(PublicWorkspacePage, { profile: profile(), bookingOpen: false }));
  assert.match(html, /Agenda temporariamente fechada/);
  assert.match(html, /Reservas pausadas/);
  assert.doesNotMatch(html, /Agendar horário/);
});
