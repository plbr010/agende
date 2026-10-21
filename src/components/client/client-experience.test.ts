import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LogoCropField } from "@/components/workspace/logo-crop-field";
import { readPublicWorkspaceId } from "@/lib/client/favorites";
import { firstNameFrom, parseClientProfileUpdate } from "@/lib/client/profile";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function source(relative: string) {
  return readFileSync(join(root, relative), "utf8");
}

test("audience split uses the approved client and professional copy", () => {
  const split = source("src/components/marketing/audience-split.tsx");
  assert.match(split, /O Agendê é para você\./);
  assert.match(split, /Seja para cuidar do seu negócio ou reservar um momento para você, comece por aqui\./);
  assert.match(split, /Mais organização, menos trabalho\./);
  assert.match(split, /Conhecer o Agendê/);
  assert.match(split, /Seu próximo momento de beleza está a poucos cliques\./);
  assert.match(split, /Encontrar um salão/);
  assert.match(split, /relative isolate overflow-hidden/);
  assert.match(split, /relative z-10 mx-auto grid/);
  assert.match(split, /FloralCorner className="[^"]*-left-12/);
  assert.doesNotMatch(split, /absolute left-0 top-4 h-32 w-40 opacity-80/);
  assert.doesNotMatch(split, /nunca o plano/);
  assert.doesNotMatch(split, /preços da assinatura/);
  assert.doesNotMatch(source("src/app/page.tsx"), /Sou profissional ou sou cliente\?/);
});

test("client chrome has a personal nav and no SaaS prices", () => {
  const shell = source("src/components/client/client-shell.tsx");
  assert.match(shell, /Início/);
  assert.match(shell, /Explorar/);
  assert.match(shell, /Agendamentos/);
  assert.match(shell, /Agenda/);
  assert.match(shell, /minmax\(0,1fr\)/);
  assert.match(shell, /max-\[389px\]:sr-only/);
  assert.match(shell, /Favoritos/);
  assert.match(shell, /Perfil/);
  assert.match(shell, /\/cliente\/favoritos/);
  assert.match(shell, /\/cliente\/perfil/);
  assert.match(shell, /\/cliente\/descobrir/);
  assert.doesNotMatch(shell, /R\$ 89/);
  assert.doesNotMatch(shell, /assinatura/);
  assert.doesNotMatch(shell, /\/app\/configuracoes\/assinatura/);
  assert.doesNotMatch(shell, /Solo/);
  assert.doesNotMatch(shell, /Equipe/);
});

test("client home greets by first name and never advertises professional plans", () => {
  const home = source("src/components/client/client-home.tsx");
  assert.match(home, /Olá, \$\{firstName\}!/);
  assert.match(home, /Seu próximo momento de beleza começa aqui\./);
  assert.match(home, /Seus favoritos/);
  assert.match(home, /Agende novamente/);
  assert.match(home, /Explore perto de você/);
  assert.doesNotMatch(home, /Também é profissional/);
  assert.doesNotMatch(home, /Cadastrar meu salão/);
  assert.doesNotMatch(home, /\/onboarding/);
  assert.doesNotMatch(home, /R\$ 89/);
  assert.doesNotMatch(source("src/app/cliente/page.tsx"), /loadReviewsResult/);
});

test("favorites use the account API and never persist in the browser", () => {
  const favoritos = source("src/app/cliente/favoritos/page.tsx");
  const panel = source("src/components/client/favorites-panel.tsx");
  const home = source("src/components/client/client-home.tsx");
  const actions = source("src/lib/client/favorite-actions.ts");
  for (const file of [favoritos, panel, home, actions]) {
    assert.doesNotMatch(file, /localStorage/);
    assert.doesNotMatch(file, /sessionStorage/);
  }
  assert.match(favoritos, /loadWorkspaceFavorites/);
  assert.match(actions, /add_my_workspace_favorite/);
  assert.match(actions, /remove_my_workspace_favorite/);
  assert.match(actions, /get_public_workspace_profile/);
  assert.equal(readPublicWorkspaceId({ slug: "luna", name: "Luna" }), null);
});

test("profile edits name, phone and optional city, and reuses the private avatar route", () => {
  const action = source("src/lib/client/actions.ts");
  assert.match(action, /full_name: parsed\.data\.fullName/);
  assert.match(action, /phone: parsed\.data\.phone/);
  assert.match(action, /residence_city: parsed\.data\.residenceCity/);
  assert.match(action, /\.from\("profiles"\)/);
  assert.doesNotMatch(action, /service_role/);
  assert.doesNotMatch(action, /intended_use/);
  assert.doesNotMatch(action, /email:/);
  const editor = source("src/components/account/account-photo-editor.tsx");
  assert.match(editor, /\/api\/account\/avatar/);
  assert.doesNotMatch(editor, /localStorage/);
  const save = editor.slice(editor.indexOf("async function saveDraft"), editor.indexOf("async function removePhoto"));
  assert.ok(save.indexOf("Foto atualizada") > save.indexOf("if (!response.ok)"));
  assert.match(editor, /Salvar foto/);
  assert.match(editor, /Cancelar/);
  assert.match(editor, /role="progressbar"/);
  const logo = source("src/components/workspace/logo-crop-field.tsx");
  const logoMarkup = renderToStaticMarkup(createElement(LogoCropField, { currentUrl: null, salonName: "Studio" }));
  assert.match(logoMarkup, /name="logo"/);
  const publicImageMarkup = renderToStaticMarkup(createElement(LogoCropField, { currentUrl: "/fixture-logo.webp", salonName: "Studio", inputName: "image", inputId: "workspace-image-logo", allowRemoval: false }));
  assert.match(publicImageMarkup, /name="image"/);
  assert.doesNotMatch(publicImageMarkup, /name="clearLogo"/);
  assert.doesNotMatch(publicImageMarkup, /capa e a galeria ainda não fazem parte/);
  assert.doesNotMatch(logo, /fetch\(/);
  assert.match(source("src/app/cliente/perfil/page.tsx"), /residenceCity/);
  const parsed = parseClientProfileUpdate({ fullName: "  Ana Souza ", phone: "(32) 99999-9999", residenceCity: " Juiz de Fora " });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.fullName, "Ana Souza");
    assert.equal(parsed.data.phone, "+5532999999999");
    assert.equal(parsed.data.residenceCity, "Juiz de Fora");
  }
  assert.equal(parseClientProfileUpdate({ fullName: "Ana Souza", phone: "(32) 99999-9999", residenceCity: "" }).success, true);
  assert.equal(parseClientProfileUpdate({ fullName: "A", phone: "32999999999" }).success, false);
  assert.equal(firstNameFrom("Ana Carolina Souza"), "Ana");
  assert.equal(firstNameFrom("  "), "");
});

test("identidade cliente preview is noindex and uses empty real states", () => {
  const preview = source("src/app/identidade/cliente/page.tsx");
  assert.match(preview, /index: false/);
  assert.match(preview, /next=\{null\}/);
  assert.match(preview, /recentWorkspaces=\{\[\]\}/);
  assert.doesNotMatch(preview, /priceCents/);
  assert.match(source("src/app/identidade/cliente/favoritos/page.tsx"), /FavoritesPanel/);
  assert.match(source("src/app/identidade/cliente/perfil/page.tsx"), /ClientProfileForm/);
});
