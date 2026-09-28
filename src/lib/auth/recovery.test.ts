import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendRecovery, exchangeRecovery, changeRecoveredPassword } from "./recovery";
import { sanitizeNextPath } from "./redirects";
import { safeRequestOrigin } from "../http/safe-origin";

type Auth = SupabaseClient["auth"];
function mockAuth(error: object | null = null) {
  const calls: unknown[][] = [];
  const result = { data: { user: error ? null : { id: "client" }, session: null }, error };
  const auth = Object.fromEntries(["resetPasswordForEmail", "exchangeCodeForSession", "verifyOtp", "getUser", "updateUser", "signOut"].map(name => [name, async (...args: unknown[]) => { calls.push([name, ...args]); return result; }])) as unknown as Auth;
  return { auth, calls };
}

test("recovery sends normalized email with a fixed recovery path and no account disclosure", async () => {
  const { auth, calls } = mockAuth();
  assert.ok((await sendRecovery(auth, "USER@example.com", "https://agende.example")).success);
  assert.deepEqual(calls[0], ["resetPasswordForEmail", "user@example.com", { redirectTo: "https://agende.example/auth/recovery" }]);
  assert.ok((await sendRecovery(auth, "bad", "https://agende.example")).error);
  assert.equal(calls.length, 1);
  assert.ok((await sendRecovery(mockAuth({ code: "over_email_send_rate_limit" }).auth, "user@example.com", "https://agende.example")).error);
});

test("recovery validates PKCE or recovery OTP and rejects expired, missing and wrong-type tokens", async () => {
  assert.equal(await exchangeRecovery(mockAuth().auth, new URLSearchParams("code=valid&next=https://evil.example")), true);
  const { auth, calls } = mockAuth();
  assert.equal(await exchangeRecovery(auth, new URLSearchParams("token_hash=valid&type=recovery")), true);
  assert.deepEqual(calls[0], ["verifyOtp", { token_hash: "valid", type: "recovery" }]);
  for (const value of ["", "token_hash=valid&type=signup", "error=access_denied&code=valid"]) {
    const mock = mockAuth();
    assert.equal(await exchangeRecovery(mock.auth, new URLSearchParams(value)), false);
    assert.equal(mock.calls.length, 0);
  }
  for (const value of ["code=expired", "token_hash=invalid&type=recovery"]) assert.equal(await exchangeRecovery(mockAuth({ code: "otp_expired" }).auth, new URLSearchParams(value)), false);
});

test("password update requires a verified user, validates password and signs out for normal login", async () => {
  const valid = { password: "Password123", confirmPassword: "Password123" };
  for (const input of [{ password: "short", confirmPassword: "short" }, { ...valid, confirmPassword: "different" }, { password: "12345678", confirmPassword: "12345678" }]) {
    const { auth, calls } = mockAuth();
    assert.ok((await changeRecoveredPassword(auth, input)).error);
    assert.equal(calls.length, 0);
  }
  const expired = mockAuth({ code: "session_not_found" });
  assert.match((await changeRecoveredPassword(expired.auth, valid)).error!, /inválido ou expirou/);
  assert.equal(expired.calls.length, 1);
  const { auth, calls } = mockAuth();
  assert.equal((await changeRecoveredPassword(auth, valid)).success, true);
  assert.deepEqual(calls, [["getUser"], ["updateUser", { password: "Password123" }], ["signOut", { scope: "local" }]]);
});

test("redirects reject encoded separators, controls, traversal to auth and untrusted host headers", () => {
  for (const value of ["//evil.com", "/%2fevil.com", "/%252fevil.com", "/%5cevil.com", "/\nevil.com", "/x/../auth/callback", "/auth/recovery", "/redefinir-senha"]) assert.equal(sanitizeNextPath(value), null, value);
  assert.equal(sanitizeNextPath("/p/studio/agendar?service=123"), "/p/studio/agendar?service=123");
  assert.equal(safeRequestOrigin("https://evil.com", "https://agende.example"), "https://agende.example");
  assert.equal(safeRequestOrigin("https://preview.vercel.app", "https://agende.example", ["preview.vercel.app"]), "https://preview.vercel.app");
});
