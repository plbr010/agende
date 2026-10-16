import assert from "node:assert/strict";
import test from "node:test";
import {
  extractInviteToken,
  inviteReturnPath,
  parseSignupJourney,
  postConfirmationPath,
  resolveSignupJourney,
  signupChoiceHref,
} from "./signup-journey";

const token = "a".repeat(64);

test("invite tokens come from the code or a convite link and reject other addresses", () => {
  assert.equal(extractInviteToken(token), token);
  assert.equal(extractInviteToken(`https://agende.app/convite/${token}`), token);
  assert.equal(extractInviteToken(`/convite/${token}?origem=whatsapp`), token);
  assert.equal(extractInviteToken("  " + token.toUpperCase() + "  "), token);
  assert.equal(extractInviteToken("https://evil.example/p/salao"), null);
  assert.equal(extractInviteToken("javascript:alert(1)"), null);
  assert.equal(extractInviteToken("//evil.example/convite/" + token), null);
  assert.equal(extractInviteToken("abc"), null);
  assert.equal(inviteReturnPath(token), `/convite/${token}`);
});

test("signup journey keeps clients away from plans and preserves an opened invite", () => {
  assert.equal(resolveSignupJourney({}), null);
  assert.equal(resolveSignupJourney({ intent: "cliente" }), "client");
  assert.equal(resolveSignupJourney({ intent: "professional" }), "owner");
  assert.equal(resolveSignupJourney({ plan: "equipe" }), "owner");
  assert.equal(resolveSignupJourney({ intent: "equipe" }), "team");
  assert.equal(resolveSignupJourney({ intent: "cliente", next: `/convite/${token}` }), "team");
  assert.equal(resolveSignupJourney({ next: `/convite/${token}`, forceChoice: true }), null);
  assert.equal(resolveSignupJourney({ next: "/p/luna/agendar" }), "client");
  assert.equal(resolveSignupJourney({ next: "/p/luna/agendar", intent: "profissional" }), "owner");
  assert.equal(resolveSignupJourney({ next: "/p/luna/agendar", forceChoice: true }), null);
  assert.equal(signupChoiceHref("client", { next: "/p/luna/agendar" }), "/cadastro?intent=cliente&next=%2Fp%2Fluna%2Fagendar");
  assert.equal(signupChoiceHref("owner", { plan: "solo" }), "/cadastro?intent=profissional&plan=solo");
  assert.equal(parseSignupJourney("team", "professional"), "team");
  assert.equal(parseSignupJourney(null, "professional"), "owner");
});

test("email confirmation returns clients to profile unless a safe destination already exists", () => {
  assert.equal(postConfirmationPath({
    next: null,
    destination: "/cliente",
    journey: "client",
    hasClientProfile: true,
    intendedUse: "client",
  }), "/cliente/perfil?inicio=1");
  assert.equal(postConfirmationPath({
    next: `/convite/${token}`,
    destination: "/onboarding",
    journey: "team",
    hasClientProfile: true,
    intendedUse: "client",
  }), `/convite/${token}`);
  assert.equal(postConfirmationPath({
    next: null,
    destination: "/onboarding",
    journey: "owner",
    hasClientProfile: false,
    intendedUse: "professional",
  }), "/onboarding");
  assert.equal(postConfirmationPath({
    next: "/p/luna/agendar",
    destination: "/cliente",
    journey: "client",
    hasClientProfile: true,
    intendedUse: "client",
  }), "/p/luna/agendar");
});
