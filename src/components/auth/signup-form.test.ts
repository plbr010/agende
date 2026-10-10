import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SignupForm } from "./signup-form";
import { LoginForm } from "./login-form";
import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";

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

test("signup explains the two paths with everyday words and a visible password hint", () => {
  const html = render(createElement(SignupForm));
  assert.match(html, /O que você quer fazer no Agendê\?/);
  assert.match(html, /Quero marcar horários/);
  assert.match(html, /Tenho salão ou atendo clientes/);
  assert.match(html, /Criar minha conta/);
  assert.match(html, /Use no mínimo 8 caracteres, com letras e números/);
  assert.match(html, /Mostrar/);
  assert.doesNotMatch(html, /workspace/i);
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
