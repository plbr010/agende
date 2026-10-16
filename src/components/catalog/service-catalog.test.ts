import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ServiceCatalog } from "./directories";
import { filterCatalogServices } from "./service-filters";
import type { ServiceRow, TeamMember } from "@/lib/catalog/queries";

const ana: TeamMember = {
  memberId: "ana",
  userId: "user-ana",
  role: "owner",
  status: "active",
  fullName: "Ana Carolina",
  email: "ana@example.com",
  displayName: "Ana",
  bio: null,
  bookingEnabled: true,
  hasProfessionalProfile: true,
  serviceCount: 1,
  joinedAt: "2026-01-01T00:00:00.000Z",
};

const services: ServiceRow[] = [
  {
    id: "manicure",
    name: "Manicure",
    description: "Esmaltação e cuidado das unhas.",
    durationMinutes: 60,
    priceCents: 7000,
    active: true,
    archivedAt: null,
    professionalMemberIds: ["ana"],
  },
  {
    id: "cor",
    name: "Coloração",
    description: null,
    durationMinutes: 120,
    priceCents: 22000,
    active: false,
    archivedAt: null,
    professionalMemberIds: [],
  },
];

test("service filters keep active, hidden and unassigned services apart", () => {
  assert.deepEqual(filterCatalogServices(services, "active", "all").map((service) => service.name), ["Manicure"]);
  assert.deepEqual(filterCatalogServices(services, "hidden", "all").map((service) => service.name), ["Coloração"]);
  assert.deepEqual(filterCatalogServices(services, "all", "none").map((service) => service.name), ["Coloração"]);
  assert.deepEqual(filterCatalogServices(services, "all", "ana").map((service) => service.name), ["Manicure"]);
});

test("service catalog shows price, duration, people and does not replace an error with the empty state", () => {
  const html = renderToStaticMarkup(createElement(ServiceCatalog, {
    services,
    professionals: [ana],
    canManage: true,
    currentMemberId: null,
  }));
  assert.match(html, /Manicure/);
  assert.match(html, /60 min/);
  assert.match(html, /Ana/);
  assert.match(html, /Na agenda/);
  assert.match(html, /Ocultos na agenda online/);
  assert.match(html, /Novo serviço/);
  assert.match(html, /Filtrar por visibilidade/);
  assert.match(html, /Filtrar por profissional/);
  assert.doesNotMatch(html, /Nenhum serviço ainda/);

  const failed = renderToStaticMarkup(createElement(ServiceCatalog, {
    services: [],
    professionals: [],
    canManage: true,
    currentMemberId: null,
    loadError: "permission denied for table services",
    teamError: "permission denied for table workspace_members",
  }));
  assert.match(failed, /permission denied for table services/);
  assert.match(failed, /permission denied for table workspace_members/);
  assert.doesNotMatch(failed, /Nenhum serviço ainda/);
  assert.doesNotMatch(failed, /Cadastre uma profissional na equipe antes de salvar o serviço/);
});

test("service search with no rows explains the query instead of inviting the first service", () => {
  const html = renderToStaticMarkup(createElement(ServiceCatalog, {
    services: [],
    professionals: [],
    canManage: true,
    currentMemberId: null,
    query: "barba",
  }));
  assert.match(html, /Nenhum serviço encontrado para “barba”/);
  assert.doesNotMatch(html, /Cadastrar o primeiro serviço/);
});
