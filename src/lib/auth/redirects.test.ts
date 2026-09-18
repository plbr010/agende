import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessPath,
  getDefaultDestination,
  getFallbackForDeniedPath,
} from "../auth/redirects";

test("unconfirmed users always go to email verification", () => {
  const ctx = {
    emailConfirmed: false,
    intendedUse: "professional" as const,
    hasWorkspace: false,
    hasClientProfile: false,
  };
  assert.equal(getDefaultDestination(ctx), "/verificar-email");
  assert.equal(canAccessPath("/app", ctx), false);
  assert.equal(canAccessPath("/cliente", ctx), false);
  assert.equal(canAccessPath("/onboarding", ctx), false);
});

test("client without workspace lands on /cliente", () => {
  const ctx = {
    emailConfirmed: true,
    intendedUse: "client" as const,
    hasWorkspace: false,
    hasClientProfile: true,
  };
  assert.equal(getDefaultDestination(ctx), "/cliente");
  assert.equal(canAccessPath("/app", ctx), false);
  assert.equal(getFallbackForDeniedPath("/app", ctx), "/cliente");
});

test("professional without workspace lands on onboarding", () => {
  const ctx = {
    emailConfirmed: true,
    intendedUse: "professional" as const,
    hasWorkspace: false,
    hasClientProfile: false,
  };
  assert.equal(getDefaultDestination(ctx), "/onboarding");
  assert.equal(canAccessPath("/onboarding", ctx), true);
  assert.equal(canAccessPath("/app", ctx), false);
});

test("professional with workspace lands on /app", () => {
  const ctx = {
    emailConfirmed: true,
    intendedUse: "professional" as const,
    hasWorkspace: true,
    hasClientProfile: false,
  };
  assert.equal(getDefaultDestination(ctx), "/app");
  assert.equal(canAccessPath("/app", ctx), true);
  assert.equal(canAccessPath("/cliente", ctx), false);
});
