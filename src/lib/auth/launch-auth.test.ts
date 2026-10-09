import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as plans from "../billing/plans";
import * as redirects from "./redirects";
import * as signup from "../validation/signup";
import * as email from "../validation/email";

// Executes the real server modules with isolated platform adapters, never a network client.
function sourceModule<T>(file: string, dependencies: Record<string, unknown>): T {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } });
  const exports = {};
  runInNewContext(outputText, { exports, FormData, URL, process: { env: { NODE_ENV: "test" } },
    require(name: string) {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  return exports as T;
}

const user = { id: "user", email: "test@example.invalid", email_confirmed_at: "2026-10-01" };
function sessionLoader(failingTable?: string) {
  const rows: Record<string, unknown> = {
    profiles: { full_name: "Test", email: user.email, intended_use: "professional" },
    client_profiles: null,
    workspace_members: [{ role: "owner", workspaces: { id: "studio", name: "Studio", slug: "studio" } }],
    subscriptions: { plan: "solo", status: "trialing" },
  };
  return sourceModule<{ loadAppSession: () => Promise<{ workspaces: unknown[] }> }>("./session.ts", {
    "next/navigation": {}, "@/lib/auth/redirects": redirects,
    "@/lib/auth/session-guard": { createConfirmedSessionGuard: () => null },
    "@/lib/supabase/server": { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user } }) },
      from(table: string) {
        const result = { data: rows[table], error: table === failingTable ? { message: "private diagnostic" } : null };
        return { select() { return this; }, eq() { return this; }, maybeSingle: async () => result,
          then(resolve: (value: unknown) => unknown) { return Promise.resolve(result).then(resolve); } };
      },
    }) },
  }).loadAppSession;
}

test("session data outages never masquerade as onboarding, missing client profile or missing subscription", async () => {
  for (const table of ["profiles", "client_profiles", "workspace_members", "subscriptions"]) {
    await assert.rejects(sessionLoader(table), error =>
      /Não foi possível carregar/.test(String(error)) && !String(error).includes("private diagnostic"));
  }
  assert.equal((await sessionLoader()()).workspaces.length, 1);
});

function actions(error: { code?: string; message: string; status?: number } | null = null) {
  const calls: Array<{ name: string; value?: unknown }> = [];
  const cookies = new Map<string, string>();
  const mod = sourceModule<{
    signUpAction: (previous: object, form: FormData) => Promise<{ error?: string }>;
    signInAction: (previous: object, form: FormData) => Promise<{ error?: string }>;
    signOutAction: () => Promise<void>;
  }>("./actions.ts", {
    "@/lib/billing/plans": plans,
    "next/headers": { cookies: async () => ({ get: (name: string) => ({ value: cookies.get(name) }),
      set: (name: string, value: string) => cookies.set(name, value) }) },
    "next/navigation": { redirect: (path: string) => { calls.push({ name: "redirect", value: path }); throw new Error(`redirect:${path}`); } },
    "@/lib/auth/redirects": redirects,
    "@/lib/auth/session": { loadAppSession: async () => ({ context: {
      emailConfirmed: true, intendedUse: "professional", hasWorkspace: false, hasClientProfile: false,
    } }) },
    "@/lib/http/origin": { getRequestOrigin: async () => "https://agende.test" },
    "@/lib/validation/email": email, "@/lib/validation/signup": signup,
    "@/lib/supabase/server": { createClient: async () => ({ auth: {
      signUp: async (value: unknown) => { calls.push({ name: "signup", value }); return { error }; },
      signInWithPassword: async (value: unknown) => { calls.push({ name: "login", value }); return { error }; },
      signOut: async () => { calls.push({ name: "logout" }); return { error }; },
    } }) },
  });
  return { ...mod, calls, cookies };
}

function signupForm(intendedUse: string) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ intendedUse, fullName: "Test User", email: "TEST@example.invalid",
    phone: "55999999999", password: "Password123", confirmPassword: "Password123", termsAccepted: "on", plan: "equipe", next: "https://evil.invalid" })) form.set(key, value);
  return form;
}

test("client and professional signup preserve intent and selected plan without provisioning a trial", async () => {
  for (const intent of ["client", "professional"]) {
    const h = actions();
    await assert.rejects(h.signUpAction({}, signupForm(intent)), /redirect:\/verificar-email\?status=sent/);
    const payload = h.calls[0].value as { email: string; options: { data: { intended_use: string }; emailRedirectTo: string } };
    assert.equal(payload.email, "test@example.invalid");
    assert.equal(payload.options.data.intended_use, intent);
    assert.equal(payload.options.emailRedirectTo, "https://agende.test/auth/callback");
    assert.equal(h.cookies.get("agende_selected_plan"), intent === "professional" ? "equipe" : undefined);
  }
  const h = actions();
  assert.ok((await h.signUpAction({}, signupForm("owner"))).error);
  assert.equal(h.calls.length, 0);
});

test("signup only reports duplicate accounts for the actual duplicate-account error", async () => {
  assert.match((await actions({ code: "user_already_exists", message: "duplicate", status: 422 }).signUpAction({}, signupForm("client"))).error!, /já possui/);
  const h = actions({ code: "weak_password", message: "private password policy", status: 422 });
  const result = await h.signUpAction({}, signupForm("client"));
  assert.match(result.error!, /Não foi possível criar/);
  assert.doesNotMatch(result.error!, /já possui|private/);
  assert.equal(h.calls.some(call => call.name === "redirect"), false);
});

test("login denies bad credentials, directs unconfirmed users and sanitizes return destinations", async () => {
  const form = new FormData(); form.set("email", "TEST@example.invalid"); form.set("password", "Password123"); form.set("next", "//evil.invalid");
  assert.match((await actions({ message: "invalid credentials" }).signInAction({}, form)).error!, /incorretos/);
  await assert.rejects(actions({ message: "Email not confirmed" }).signInAction({}, form), /redirect:\/verificar-email\?status=unconfirmed/);
  await assert.rejects(actions().signInAction({}, form), /redirect:\/onboarding/);
});

test("logout errors do not falsely claim success or redirect an authenticated session", async () => {
  const failed = actions({ message: "private auth outage" });
  await assert.rejects(failed.signOutAction(), /Não foi possível encerrar/);
  assert.equal(failed.calls.some(call => call.name === "redirect"), false);
  await assert.rejects(actions().signOutAction(), /redirect:\/$/);
});

test("confirmation routes exchange valid tokens, preserve safe destinations and reject expired tokens", async () => {
  for (const route of ["callback", "confirm"]) {
    for (const expired of [false, true]) {
      const calls: string[] = [];
      const result = { error: expired ? { code: "otp_expired" } : null };
      const mod = sourceModule<{ GET: (request: { url: string; nextUrl: URL }) => Promise<string> }>(`../../app/auth/${route}/route.ts`, {
        "next/server": { NextResponse: { redirect: (url: unknown) => String(url) } },
        "@/lib/supabase/server": { createClient: async () => ({ auth: {
          exchangeCodeForSession: async () => { calls.push("pkce"); return result; },
          verifyOtp: async () => { calls.push("otp"); return result; },
        } }) },
        "@/lib/auth/redirects": redirects,
        "@/lib/auth/session": { loadAppSession: async () => ({ context: {
          emailConfirmed: true, intendedUse: "client", hasWorkspace: false, hasClientProfile: true,
        } }) },
      });
      const params = route === "callback" ? "code=isolated-test" : "token_hash=isolated-test&type=signup";
      const url = new URL(`https://agende.test/auth/${route}?${params}&next=https://evil.invalid`);
      const destination = new URL(await mod.GET({ url: url.href, nextUrl: Object.assign(url, { clone: () => new URL(url) }) }));
      assert.equal(destination.origin, "https://agende.test");
      assert.equal(destination.pathname, expired ? "/verificar-email" : "/cliente");
      assert.equal(calls.length, 1);
    }
  }
});

test("confirmation forwards recovery tokens to the recovery handler without accepting arbitrary OTP types", async () => {
  let calls = 0;
  const mod = sourceModule<{ GET: (request: { url: string; nextUrl: URL }) => Promise<string> }>("../../app/auth/confirm/route.ts", {
    "next/server": { NextResponse: { redirect: (url: unknown) => String(url) } },
    "@/lib/supabase/server": { createClient: async () => { calls++; throw new Error("must not contact auth"); } },
    "@/lib/auth/redirects": redirects, "@/lib/auth/session": {},
  });
  for (const type of ["recovery", "invalid"]) {
    const url = new URL(`https://agende.test/auth/confirm?token_hash=isolated-test&type=${type}`);
    const destination = new URL(await mod.GET({ url: url.href, nextUrl: Object.assign(url, { clone: () => new URL(url) }) }));
    assert.equal(destination.pathname, type === "recovery" ? "/auth/recovery" : "/verificar-email");
    if (type === "recovery") assert.equal(destination.searchParams.get("token_hash"), "isolated-test");
  }
  assert.equal(calls, 0);
});
