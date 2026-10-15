import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SignupForm } from "./signup-form";
import { SignupChooser } from "./signup-chooser";
import { InviteEntry } from "./invite-entry";
import { LoginForm } from "./login-form";
import { CreateWorkspaceForm, PlanChoiceForm } from "@/components/workspace/create-workspace-form";
import type { InvitePeek } from "@/lib/workspace/public";

function render(node: ReactElement) {
  const noop = () => {};
  return renderToStaticMarkup(
    createElement(AppRouterContext.Provider, {
      value: {
        back: noop,
        forward: noop,
        refresh: noop,
        push: noop,
        replace: noop,
        prefetch: noop,
        bfcacheId: "test",
      },
    }, node),
  );
}

test("signup opens with three plain choices and no subscription prices", () => {
  const html = render(createElement(SignupChooser, { next: "/convite/" + "ab".repeat(16) }));
  assert.match(html, /Como você quer usar o Agendê\?/);
  assert.match(html, /Quero agendar serviços/);
  assert.match(html, /Tenho meu próprio salão/);
  assert.match(html, /Trabalho em um salão parceiro/);
  assert.match(html, /intent=cliente/);
  assert.match(html, /intent=profissional/);
  assert.match(html, /intent=equipe/);
  assert.match(html, /convite/);
  assert.doesNotMatch(html, /R\$/);
  assert.doesNotMatch(html, /workspace/i);
});

test("client signup stays free of salon setup and subscription prices", () => {
  const html = render(createElement(SignupForm, { journey: "client" }));
  assert.match(html, /Conta de cliente/);
  assert.match(html, /Criar conta de cliente/);
  assert.match(html, /Sem salão, sem plano/);
  assert.match(html, /Use no mínimo 8 caracteres, com letras e números/);
  assert.match(html, /Mostrar/);
  assert.doesNotMatch(html, /R\$/);
  assert.doesNotMatch(html, /Nome do salão/);
  assert.doesNotMatch(html, /Tenho meu próprio salão/);
});

test("professional signup names the chosen plan and the free trial", () => {
  const html = render(createElement(SignupForm, { journey: "owner", plan: "equipe" }));
  assert.match(html, /Conta profissional/);
  assert.match(html, /Criar conta profissional/);
  assert.match(html, /Equipe/);
  assert.match(html, /7 dias grátis/);
  assert.match(html, /plano selecionado vale só para a conta profissional/i);
});

test("team signup keeps the invite and never shows a subscription price", () => {
  const next = "/convite/" + "cd".repeat(16);
  const valid: InvitePeek = {
    status: "valid",
    workspaceName: "Studio Luna",
    role: "receptionist",
    emailBound: true,
    expiresAt: "2026-12-01T00:00:00.000Z",
  };
  const html = render(createElement(InviteEntry, { peek: valid, next }));
  assert.match(html, /Studio Luna/);
  assert.match(html, /Recepção/);
  assert.match(html, /Criar conta da equipe/);
  assert.match(html, /Sem plano e sem mensalidade/);
  assert.match(html, /Já tenho conta/);
  assert.doesNotMatch(html, /R\$/);
  const expired = render(createElement(InviteEntry, {
    peek: { ...valid, status: "expired", workspaceName: null },
    next,
  }));
  assert.match(expired, /Este convite expirou/);
  assert.doesNotMatch(expired, /Criar conta da equipe/);
  const revoked = render(createElement(InviteEntry, { peek: { ...valid, status: "revoked" }, next }));
  assert.match(revoked, /Este convite foi cancelado/);
});

test("owner plan step shows the real prices before the salon name", () => {
  const html = render(createElement(PlanChoiceForm, { defaultPlan: "equipe" }));
  assert.match(html, /R\$ 89,90/);
  assert.match(html, /R\$ 169,90/);
  assert.match(html, /R\$ 299,90/);
  assert.match(html, /7 dias/);
  assert.doesNotMatch(html, /Nome do salão/);
});

test("login keeps the main action large and the password recovery visible", () => {
  const html = render(createElement(LoginForm));
  assert.match(html, />Entrar</);
  assert.match(html, /Esqueci a senha/);
  assert.match(html, /h-12/);
});

test("salon setup asks for a familiar name and a 7-day trial without a card", () => {
  const html = render(createElement(CreateWorkspaceForm));
  assert.match(html, /Nome do salão ou estúdio/);
  assert.match(html, /Criar salão e começar teste grátis/);
  assert.match(html, /Não pedimos cartão/);
  assert.doesNotMatch(html, /reiniciar os 7 dias/);
});
